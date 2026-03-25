import asyncio
import logging
from datetime import datetime
from io import BytesIO
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from src.config import settings
from src.schemas.newsletter import (
    InstagramPublishInfoResponse,
    InstagramPublishRequest,
    InstagramPublishResponse,
)
from src.services.content_task_service import get_content_task
from src.services.newsletter_service import _build_instagram_platform_output, _get_article
from src.services.s3_service import upload_newsletter_asset

logger = logging.getLogger(__name__)

INSTAGRAM_MAX_CAROUSEL_ITEMS = 10
PUBLISH_STATUS_POLL_INTERVAL_SECONDS = 5
PUBLISH_STATUS_POLL_ATTEMPTS = 6


def _ensure_instagram_task(task: Any) -> None:
    if task.content_format != "instagram":
        raise HTTPException(
            status_code=400,
            detail="Only instagram content tasks can be published to Instagram.",
        )
    if task.article_id is None:
        raise HTTPException(
            status_code=400,
            detail="This content task does not have a generated article yet.",
        )


def _coalesce(value: str | None, fallback: str) -> str:
    normalized = (value or "").strip()
    return normalized or fallback


def _resolve_publish_config(payload: InstagramPublishRequest) -> tuple[str, str, str, str]:
    access_token = _coalesce(payload.access_token, settings.instagram_publish_access_token)
    ig_user_id = _coalesce(payload.ig_user_id, settings.instagram_publish_ig_user_id)
    api_version = _coalesce(payload.api_version, settings.instagram_publish_api_version)
    host_url = _coalesce(payload.host_url, settings.instagram_publish_host_url)

    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="Instagram publish access token is missing. Provide it in the request or server settings.",
        )
    if not ig_user_id:
        raise HTTPException(
            status_code=400,
            detail="Instagram professional account ID is missing. Provide it in the request or server settings.",
        )
    return access_token, ig_user_id, api_version, host_url


def _normalize_publishable_urls(image_urls: list[str]) -> list[str]:
    return [
        url.strip()
        for url in image_urls
        if isinstance(url, str) and url.strip().startswith(("http://", "https://"))
    ]


def _extract_platform_output(article: Any) -> dict[str, Any]:
    meta = article.generation_meta or {}
    output = _build_instagram_platform_output(
        raw_value=meta.get("platform_output"),
        body_content=article.body_content,
    )
    image_urls = _normalize_publishable_urls(output.get("image_download_urls", []))
    if not image_urls:
        raise HTTPException(
            status_code=400,
            detail="No publishable Instagram image URLs were found on this article.",
        )
    if len(image_urls) > INSTAGRAM_MAX_CAROUSEL_ITEMS:
        raise HTTPException(
            status_code=400,
            detail=f"Instagram carousel posts support up to {INSTAGRAM_MAX_CAROUSEL_ITEMS} images.",
        )

    hashtags = output.get("hashtags") or []
    post_text = (output.get("post_text") or "").strip()
    hashtag_block = " ".join(tag for tag in hashtags if isinstance(tag, str) and tag.strip()).strip()
    combined_parts = [part for part in [post_text, hashtag_block] if part]
    publish_text = "\n\n".join(combined_parts).strip()

    return {
        "post_text": post_text,
        "hashtags": hashtags,
        "caption": publish_text,
        "image_urls": image_urls,
    }


def _extract_first_image_alt(body_content: dict[str, Any]) -> str | None:
    for block in body_content.get("content", []):
        if block.get("type") != "image":
            continue
        attrs = block.get("attrs") or {}
        src = attrs.get("src")
        alt = attrs.get("alt")
        if isinstance(src, str) and src.startswith(("http://", "https://")) and isinstance(alt, str):
            normalized = alt.strip()
            if normalized:
                return normalized
    return None


async def _fetch_remote_image_bytes(client: httpx.AsyncClient, image_url: str) -> bytes:
    try:
        response = await client.get(image_url, follow_redirects=True, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Instagram publish image could not be downloaded from source URL: {image_url}",
        ) from exc

    content_type = (response.headers.get("content-type") or "").lower()
    if "image" not in content_type:
        raise HTTPException(
            status_code=502,
            detail=f"Instagram publish image URL did not return an image content type: {image_url}",
        )

    content = response.content
    if not content:
        raise HTTPException(
            status_code=502,
            detail=f"Instagram publish image URL returned an empty response: {image_url}",
        )
    return content


def _convert_image_to_jpeg_bytes(image_bytes: bytes) -> bytes:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            converted = image.convert("RGB")
            output = BytesIO()
            converted.save(output, format="JPEG", quality=92, optimize=True)
            return output.getvalue()
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to parse one of the Instagram publish images as a supported image file.",
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to convert one of the Instagram publish images to JPEG.",
        ) from exc


async def _prepare_instagram_publish_urls(
    client: httpx.AsyncClient,
    *,
    article: Any,
    image_urls: list[str],
) -> list[str]:
    prepared_urls: list[str] = []

    for index, image_url in enumerate(image_urls, start=1):
        original_bytes = await _fetch_remote_image_bytes(client, image_url)
        jpeg_bytes = _convert_image_to_jpeg_bytes(original_bytes)
        uploaded_url = upload_newsletter_asset(
            file_name=f"instagram-publish-{index}.jpg",
            content_type="image/jpeg",
            content=jpeg_bytes,
            entity_key=f"{article.id}/instagram-publish",
        )
        prepared_urls.append(uploaded_url)

    return prepared_urls


def _get_existing_publish_info(article: Any) -> InstagramPublishInfoResponse | None:
    meta = article.generation_meta or {}
    raw = meta.get("instagram_publish")
    if not isinstance(raw, dict):
        return None

    try:
        return InstagramPublishInfoResponse.model_validate(raw)
    except Exception:
        logger.exception("Failed to parse existing instagram publish info for article %s", article.id)
        return None


def _store_publish_info(db: Session, article: Any, payload: dict[str, Any]) -> None:
    meta = dict(article.generation_meta or {})
    meta["instagram_publish"] = payload
    article.generation_meta = meta
    db.commit()
    db.refresh(article)


def _serialize_publish_info(
    *,
    status: str,
    attempted_at: datetime,
    image_count: int,
    host_url: str,
    ig_user_id: str,
    published_at: datetime | None = None,
    published_external_id: str | None = None,
    published_permalink: str | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    return {
        "status": status,
        "attempted_at": attempted_at.isoformat(),
        "published_at": published_at.isoformat() if published_at else None,
        "published_external_id": published_external_id,
        "published_permalink": published_permalink,
        "image_count": image_count,
        "host_url": host_url,
        "ig_user_id": ig_user_id,
        "error": error,
    }


async def _request_json(
    client: httpx.AsyncClient,
    *,
    method: str,
    url: str,
    access_token: str,
    json_payload: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {access_token}"}
    if json_payload is not None:
        headers["Content-Type"] = "application/json"

    response = await client.request(
        method,
        url,
        headers=headers,
        json=json_payload,
        params=params,
    )

    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text
        try:
            error_payload = response.json()
            detail = str(error_payload)
        except Exception:
            pass
        raise HTTPException(
            status_code=502,
            detail=f"Instagram API request failed: {detail}",
        ) from exc

    payload = response.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Instagram API returned an unexpected response.")
    return payload


async def _wait_until_container_ready(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    container_id: str,
    access_token: str,
) -> None:
    status_url = f"{base_url}/{container_id}"
    last_status = "UNKNOWN"

    for attempt in range(PUBLISH_STATUS_POLL_ATTEMPTS):
        payload = await _request_json(
            client,
            method="GET",
            url=status_url,
            access_token=access_token,
            params={"fields": "status_code"},
        )
        status_code = str(payload.get("status_code") or "").upper()
        if status_code in {"FINISHED", "PUBLISHED", ""}:
            return
        if status_code in {"ERROR", "EXPIRED"}:
            raise HTTPException(
                status_code=502,
                detail=f"Instagram media container is not publishable. status_code={status_code}",
            )

        last_status = status_code or "UNKNOWN"
        if attempt < PUBLISH_STATUS_POLL_ATTEMPTS - 1:
            await asyncio.sleep(PUBLISH_STATUS_POLL_INTERVAL_SECONDS)

    raise HTTPException(
        status_code=504,
        detail=f"Timed out waiting for Instagram media container readiness. status_code={last_status}",
    )


async def _fetch_published_media_details(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    media_id: str,
    access_token: str,
) -> dict[str, Any]:
    try:
        return await _request_json(
            client,
            method="GET",
            url=f"{base_url}/{media_id}",
            access_token=access_token,
            params={"fields": "id,permalink,media_product_type,media_type,timestamp"},
        )
    except HTTPException:
        logger.warning("Failed to fetch Instagram media details for %s", media_id)
        return {"id": media_id}


async def _create_single_image_container(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    ig_user_id: str,
    access_token: str,
    image_url: str,
    caption: str,
    alt_text: str | None,
) -> str:
    payload: dict[str, Any] = {"image_url": image_url}
    if caption:
        payload["caption"] = caption
    if alt_text:
        payload["alt_text"] = alt_text

    result = await _request_json(
        client,
        method="POST",
        url=f"{base_url}/{ig_user_id}/media",
        access_token=access_token,
        json_payload=payload,
    )
    container_id = result.get("id")
    if not isinstance(container_id, str) or not container_id:
        raise HTTPException(status_code=502, detail="Instagram did not return a media container ID.")
    return container_id


async def _create_carousel_container(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    ig_user_id: str,
    access_token: str,
    image_urls: list[str],
    caption: str,
) -> str:
    child_container_ids: list[str] = []
    for image_url in image_urls:
        child = await _request_json(
            client,
            method="POST",
            url=f"{base_url}/{ig_user_id}/media",
            access_token=access_token,
            json_payload={
                "image_url": image_url,
                "is_carousel_item": True,
            },
        )
        child_id = child.get("id")
        if not isinstance(child_id, str) or not child_id:
            raise HTTPException(
                status_code=502,
                detail="Instagram did not return a carousel child container ID.",
            )
        child_container_ids.append(child_id)

    payload: dict[str, Any] = {
        "media_type": "CAROUSEL",
        "children": ",".join(child_container_ids),
    }
    if caption:
        payload["caption"] = caption

    result = await _request_json(
        client,
        method="POST",
        url=f"{base_url}/{ig_user_id}/media",
        access_token=access_token,
        json_payload=payload,
    )
    container_id = result.get("id")
    if not isinstance(container_id, str) or not container_id:
        raise HTTPException(status_code=502, detail="Instagram did not return a carousel container ID.")
    return container_id


async def publish_instagram_content_task(
    *,
    db: Session,
    task_id: UUID,
    payload: InstagramPublishRequest,
) -> InstagramPublishResponse:
    task = get_content_task(db, task_id)
    _ensure_instagram_task(task)

    article = _get_article(db, task.article_id)
    access_token, ig_user_id, api_version, host_url = _resolve_publish_config(payload)
    base_url = f"https://{host_url}/{api_version}"

    existing_publish = _get_existing_publish_info(article)
    if existing_publish and existing_publish.status == "published" and not payload.force:
        return InstagramPublishResponse(
            task_id=task.id,
            article_id=article.id,
            publish_info=existing_publish,
        )

    publish_payload = _extract_platform_output(article)
    image_urls = publish_payload["image_urls"]
    attempted_at = datetime.now()

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            prepared_image_urls = await _prepare_instagram_publish_urls(
                client,
                article=article,
                image_urls=image_urls,
            )

            if len(prepared_image_urls) == 1:
                container_id = await _create_single_image_container(
                    client,
                    base_url=base_url,
                    ig_user_id=ig_user_id,
                    access_token=access_token,
                    image_url=prepared_image_urls[0],
                    caption=publish_payload["caption"],
                    alt_text=_extract_first_image_alt(article.body_content),
                )
            else:
                container_id = await _create_carousel_container(
                    client,
                    base_url=base_url,
                    ig_user_id=ig_user_id,
                    access_token=access_token,
                    image_urls=prepared_image_urls,
                    caption=publish_payload["caption"],
                )

            await _wait_until_container_ready(
                client,
                base_url=base_url,
                container_id=container_id,
                access_token=access_token,
            )

            publish_result = await _request_json(
                client,
                method="POST",
                url=f"{base_url}/{ig_user_id}/media_publish",
                access_token=access_token,
                json_payload={"creation_id": container_id},
            )
            media_id = publish_result.get("id")
            if not isinstance(media_id, str) or not media_id:
                raise HTTPException(status_code=502, detail="Instagram did not return a published media ID.")

            detail_payload = await _fetch_published_media_details(
                client,
                base_url=base_url,
                media_id=media_id,
                access_token=access_token,
            )

        publish_info_payload = _serialize_publish_info(
            status="published",
            attempted_at=attempted_at,
            published_at=datetime.now(),
            published_external_id=media_id,
            published_permalink=detail_payload.get("permalink"),
            image_count=len(prepared_image_urls),
            host_url=host_url,
            ig_user_id=ig_user_id,
        )
        _store_publish_info(db, article, publish_info_payload)
    except HTTPException as exc:
        error_payload = _serialize_publish_info(
            status="publish_failed",
            attempted_at=attempted_at,
            image_count=len(image_urls),
            host_url=host_url,
            ig_user_id=ig_user_id,
            error=str(exc.detail),
        )
        _store_publish_info(db, article, error_payload)
        raise
    except Exception as exc:
        logger.exception("Unexpected Instagram publish failure for task %s", task_id)
        error_payload = _serialize_publish_info(
            status="publish_failed",
            attempted_at=attempted_at,
            image_count=len(image_urls),
            host_url=host_url,
            ig_user_id=ig_user_id,
            error=f"{exc.__class__.__name__}: {exc}",
        )
        _store_publish_info(db, article, error_payload)
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected Instagram publish failure: {exc.__class__.__name__}: {exc}",
        ) from exc

    publish_info = _get_existing_publish_info(article)
    if publish_info is None:
        raise HTTPException(status_code=500, detail="Instagram publish completed but publish info could not be loaded.")

    return InstagramPublishResponse(
        task_id=task.id,
        article_id=article.id,
        publish_info=publish_info,
    )
