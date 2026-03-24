import logging
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from google import genai
from google.genai import types

from src.config import settings

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.article import Article
from src.models.article_ai_message import ArticleAIMessage
from src.models.article_image import ArticleImage
from src.models.article_source import ArticleSource
from src.models.content_task import ContentTask
from src.models.user import User
from src.schemas.newsletter import (
    ArticleAIMessageResponse,
    ArticleSourceResponse,
    NewsletterDeleteResponse,
    NewsletterDetailResponse,
    NewsletterGenerateResponse,
    NewsletterListItemResponse,
    NewsletterListResponse,
    NewsletterMessagesResponse,
    NewsletterImageUploadResponse,
    NewsletterSaveResponse,
)
from src.services.gemini_newsletter_service import (
    answer_newsletter_question,
    edit_newsletter_content,
    generate_newsletter_content,
    upload_inline_file,
)
from src.services.content_task_service import get_generation_context_for_task
from src.services.image_service import generate_image
from src.services.s3_service import upload_newsletter_asset

logger = logging.getLogger(__name__)


def _get_user(db: Session, user_id: UUID) -> User:
    user = db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


def _get_article(db: Session, article_id: UUID) -> Article:
    article = db.scalar(select(Article).where(Article.id == article_id, Article.deleted_at.is_(None)))
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")
    return article


def _get_content_task(db: Session, task_id: UUID) -> ContentTask:
    task = db.scalar(
        select(ContentTask).where(
            ContentTask.id == task_id,
            ContentTask.deleted_at.is_(None),
        )
    )
    if not task:
        raise HTTPException(status_code=404, detail="Content task not found.")
    return task


def _list_sources(db: Session, article_id: UUID) -> list[ArticleSource]:
    return list(
        db.scalars(
            select(ArticleSource)
            .where(ArticleSource.article_id == article_id, ArticleSource.deleted_at.is_(None))
            .order_by(ArticleSource.sort_order.asc(), ArticleSource.created_at.asc())
        )
    )


def _list_messages(db: Session, article_id: UUID) -> list[ArticleAIMessage]:
    return list(
        db.scalars(
            select(ArticleAIMessage)
            .where(ArticleAIMessage.article_id == article_id)
            .order_by(ArticleAIMessage.created_at.asc())
        )
    )


def _list_articles(db: Session) -> list[Article]:
    return _list_articles_filtered(db=db, author_user_id=None)


def _list_articles_filtered(db: Session, author_user_id: UUID | None) -> list[Article]:
    stmt = select(Article).where(Article.deleted_at.is_(None))
    if author_user_id is not None:
        stmt = stmt.where(Article.author_user_id == author_user_id)

    return list(db.scalars(stmt.order_by(Article.created_at.desc())))


def _get_author_map(db: Session, user_ids: list[UUID]) -> dict[UUID, User]:
    unique_ids = list(dict.fromkeys(user_ids))
    if not unique_ids:
        return {}

    users = list(
        db.scalars(
            select(User).where(
                User.id.in_(unique_ids),
                User.deleted_at.is_(None),
            )
        )
    )
    return {user.id: user for user in users}


def _get_thumbnail_map(db: Session, article_ids: list[UUID]) -> dict[UUID, str]:
    if not article_ids:
        return {}

    images = list(
        db.scalars(
            select(ArticleImage)
            .where(
                ArticleImage.article_id.in_(article_ids),
                ArticleImage.deleted_at.is_(None),
            )
            .order_by(
                ArticleImage.article_id.asc(),
                ArticleImage.sort_order.asc(),
                ArticleImage.created_at.asc(),
            )
        )
    )

    thumbnails: dict[UUID, str] = {}
    for image in images:
        if image.article_id not in thumbnails:
            thumbnails[image.article_id] = image.image_url
    return thumbnails


def _serialize_sources(sources: list[ArticleSource]) -> list[dict[str, Any]]:
    return [
        {
            "id": str(source.id),
            "source_type": source.source_type,
            "original_name": source.original_name,
            "source_url": source.source_url,
            "storage_url": source.storage_url,
            "mime_type": source.mime_type,
            "extracted_text": source.extracted_text,
            "sort_order": source.sort_order,
        }
        for source in sources
    ]


def _serialize_messages(messages: list[ArticleAIMessage]) -> list[dict[str, Any]]:
    return [
        {
            "id": str(message.id),
            "role": message.role,
            "message_text": message.message_text,
            "message_kind": message.message_kind,
            "created_at": message.created_at.isoformat() if message.created_at else None,
        }
        for message in messages
    ]


def _extract_image_urls(body_content: dict[str, Any]) -> list[str]:
    image_urls: list[str] = []
    for block in body_content.get("content", []):
        if block.get("type") == "image":
            attrs = block.get("attrs") or {}
            src = attrs.get("src")
            if isinstance(src, str) and src:
                image_urls.append(src)
    return image_urls


def _iter_image_attrs(node: dict[str, Any]) -> list[dict[str, Any]]:
    attrs_list: list[dict[str, Any]] = []

    if node.get("type") == "image":
        attrs = node.setdefault("attrs", {})
        attrs_list.append(attrs)

    for child in node.get("content", []):
        if isinstance(child, dict):
            attrs_list.extend(_iter_image_attrs(child))

    return attrs_list


def _has_inline_image_data(body_content: dict[str, Any]) -> bool:
    for attrs in _iter_image_attrs(body_content):
        src = attrs.get("src")
        if isinstance(src, str) and src.startswith("data:image/"):
            return True
    return False


def _flatten_text_content(node: dict[str, Any]) -> str:
    texts: list[str] = []
    for child in node.get("content", []):
        child_type = child.get("type")
        if child_type == "text":
            text = child.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())
        elif isinstance(child, dict):
            nested = _flatten_text_content(child)
            if nested:
                texts.append(nested)
    return " ".join(part for part in texts if part).strip()


def _truncate_summary(text: str, limit: int = 110) -> str:
    normalized = " ".join(text.split()).strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def _extract_summary(body_content: dict[str, Any]) -> str | None:
    blocks = body_content.get("content", [])
    preferred_order = ("paragraph", "quote", "heading")

    for block_type in preferred_order:
        for block in blocks:
            if block.get("type") != block_type:
                continue
            text = _flatten_text_content(block)
            if text:
                return _truncate_summary(text)
    return None


def _has_unresolved_image_blocks(body_content: dict[str, Any]) -> bool:
    for block in body_content.get("content", []):
        if block.get("type") != "image":
            continue

        attrs = block.get("attrs") or {}
        src = attrs.get("src")
        if _needs_generated_image(src):
            return True
    return False


def _needs_generated_image(src: str | None) -> bool:
    if not src:
        return True

    lowered = src.lower().strip()
    if not lowered.startswith(("http://", "https://")):
        return True

    placeholder_markers = (
        "picsum.photos",
        "placehold.co",
        "placeholder",
        "example.com",
    )
    return any(marker in lowered for marker in placeholder_markers)


def _finalize_warnings(body_content: dict[str, Any], warnings: list[str]) -> list[str]:
    resolved_all_images = not _has_unresolved_image_blocks(body_content)
    finalized: list[str] = []

    for warning in warnings:
        lowered = warning.lower()
        if resolved_all_images and (
            "image url" in lowered
            or "src" in lowered
            or "placeholder" in lowered
            or "이미지 url" in warning
            or "src는 비워" in warning
            or "src를 비워" in warning
        ):
            continue
        finalized.append(warning)

    return finalized


def _build_image_prompt(
    *,
    article_title: str | None,
    content_format: str,
    template_style: str,
    alt_text: str | None,
) -> str:
    def _to_ascii_hint(value: str | None, fallback: str) -> str:
        if not value:
            return fallback

        ascii_only = value.encode("ascii", "ignore").decode("ascii")
        normalized = " ".join(ascii_only.split())
        return normalized or fallback

    safe_title = _to_ascii_hint(article_title, "Untitled article")
    safe_template_style = _to_ascii_hint(template_style, "clean editorial")
    safe_description = _to_ascii_hint(alt_text, "editorial hero image for the article")
    return (
        f"Create a polished editorial illustration for a {content_format} article. "
        f"Template style hint: {safe_template_style}. "
        f"Article title hint: {safe_title}. "
        f"Image brief: {safe_description}. "
        "Use a clean modern newsletter aesthetic, 16:9 composition. "
        "Do not render any visible text, letters, numbers, Hangul, logos, signage, UI labels, or captions."
    )


async def _materialize_generated_images(
    *,
    body_content: dict[str, Any],
    article_title: str | None,
    content_format: str,
    template_style: str,
    entity_key: str,
) -> list[str]:
    warnings: list[str] = []
    resolved_content: list[dict[str, Any]] = []

    for index, block in enumerate(body_content.get("content", [])):
        if block.get("type") != "image":
            resolved_content.append(block)
            continue

        attrs = block.setdefault("attrs", {})
        current_src = attrs.get("src")
        if not _needs_generated_image(current_src):
            resolved_content.append(block)
            continue

        alt_text = attrs.get("alt")
        prompt = _build_image_prompt(
            article_title=article_title,
            content_format=content_format,
            template_style=template_style,
            alt_text=alt_text,
        )
        last_exc: Exception | None = None
        for attempt in range(2):
            try:
                image_bytes = await generate_image(prompt)
                uploaded_url = upload_newsletter_asset(
                    file_name=f"generated-image-{index}.png",
                    content_type="image/png",
                    content=image_bytes,
                    entity_key=entity_key,
                )
                attrs["src"] = uploaded_url
                resolved_content.append(block)
                last_exc = None
                break
            except Exception as exc:
                last_exc = exc
                logger.exception(
                    "Failed to generate image for block %s on attempt %s",
                    index + 1,
                    attempt + 1,
                )

        if last_exc is not None:
            warnings.append(
                f"Removed image block {index + 1} after image generation failed twice: "
                f"{last_exc.__class__.__name__}: {last_exc}"
            )
            continue

    body_content["content"] = resolved_content
    return warnings


def _sync_article_images(db: Session, article_id: UUID, body_content: dict[str, Any]) -> None:
    now = datetime.now()
    existing = list(
        db.scalars(
            select(ArticleImage).where(
                ArticleImage.article_id == article_id,
                ArticleImage.deleted_at.is_(None),
            )
        )
    )
    for image in existing:
        image.deleted_at = now

    for index, image_url in enumerate(_extract_image_urls(body_content)):
        db.add(ArticleImage(article_id=article_id, image_url=image_url, sort_order=index))


async def generate_newsletter(
    *,
    db: Session,
    user_id: UUID,
    content_task_id: UUID | None,
    content_format: str,
    template_style: str,
    instruction: str,
    urls: list[str],
    url_names: list[str],
    files: list[UploadFile],
) -> NewsletterGenerateResponse:
    user = _get_user(db, user_id)
    entity_key = str(uuid4())
    source_payloads: list[dict[str, Any]] = []
    gemini_files: list[Any] = []
    effective_instruction = instruction
    effective_urls = list(urls)
    effective_content_format = content_format
    effective_template_style = template_style
    fallback_topic: str | None = None
    task: ContentTask | None = None

    if content_task_id is not None:
        task = _get_content_task(db, content_task_id)
        if task.article_id is not None:
            existing_article = db.scalar(
                select(Article).where(
                    Article.id == task.article_id,
                    Article.deleted_at.is_(None),
                )
            )
            if existing_article is not None:
                raise HTTPException(
                    status_code=409,
                    detail="This content task already has a linked article.",
                )

        task_context = get_generation_context_for_task(db=db, task_id=content_task_id)
        effective_content_format = task.content_format
        effective_template_style = task.template_style or template_style
        effective_instruction = (
            f"{task_context['instruction_prefix']}\n\n"
            f"Additional user instruction:\n{instruction}"
        )
        effective_urls = [*task_context["image_urls"], *effective_urls]
        fallback_topic = task_context["topic"]

        source_payloads.append(
            {
                "source_type": "url",
                "original_name": "content-task-source",
                "source_url": None,
                "storage_url": None,
                "mime_type": "text/plain",
                "extracted_text": task_context["source_bundle"]["sourceText"],
                "sort_order": 0,
            }
        )
        for index, image_url in enumerate(task_context["image_urls"], start=1):
            source_payloads.append(
                {
                    "source_type": "image",
                    "original_name": f"task-image-{index}",
                    "source_url": image_url,
                    "storage_url": image_url,
                    "mime_type": "image/*",
                    "extracted_text": None,
                    "sort_order": index,
                }
            )

    url_sort_start = len(source_payloads)
    for i, url in enumerate(urls):
        lower_url = url.lower()
        source_type = "url"
        if lower_url.endswith(".pdf"):
            source_type = "pdf"
        elif any(lower_url.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp")):
            source_type = "image"

        source_payloads.append(
            {
                "source_type": source_type,
                "original_name": url_names[i] if i < len(url_names) else url,
                "source_url": url,
                "storage_url": None,
                "mime_type": None,
                "extracted_text": None,
                "sort_order": url_sort_start + i,
            }
        )

    for index, file in enumerate(files, start=len(source_payloads)):
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        storage_url = upload_newsletter_asset(
            file_name=file.filename or "upload.bin",
            content_type=file.content_type or "application/octet-stream",
            content=content,
            entity_key=entity_key,
        )
        gemini_files.append(upload_inline_file(file.filename or "upload.bin", content))

        source_payloads.append(
            {
                "source_type": "pdf" if file.content_type == "application/pdf" else "image",
                "original_name": file.filename,
                "source_url": None,
                "storage_url": storage_url,
                "mime_type": file.content_type,
                "extracted_text": None,
                "sort_order": index,
            }
        )

    generated = generate_newsletter_content(
        instruction=effective_instruction,
        content_format=effective_content_format,
        template_style=effective_template_style,
        urls=effective_urls,
        uploaded_files=gemini_files,
    )
    image_warnings = await _materialize_generated_images(
        body_content=generated["bodyContent"],
        article_title=generated.get("title"),
        content_format=effective_content_format,
        template_style=effective_template_style,
        entity_key=entity_key,
    )

    final_warnings = _finalize_warnings(
        generated["bodyContent"],
        [*generated.get("warnings", []), *image_warnings],
    )

    article = Article(
        content_format=effective_content_format,
        topic=generated.get("topic") or fallback_topic,
        template_style=effective_template_style,
        title=generated.get("title"),
        body_content=generated["bodyContent"],
        generation_meta={
            "model": "gemini-2.5-flash",
            "instruction": instruction,
            "url_count": len(urls),
            "file_count": len(files),
            "content_task_id": str(content_task_id) if content_task_id else None,
            "warnings": final_warnings,
        },
        author_user_id=user.id,
    )
    db.add(article)
    db.flush()

    sources: list[ArticleSource] = []
    for payload in source_payloads:
        source = ArticleSource(article_id=article.id, **payload)
        db.add(source)
        sources.append(source)

    user_message = ArticleAIMessage(
        article_id=article.id,
        role="user",
        message_text=instruction,
        message_kind="generate",
    )
    assistant_message = ArticleAIMessage(
        article_id=article.id,
        role="assistant",
        message_text=generated.get(
            "assistantMessage",
            "Draft created. You can now ask questions or request edits.",
        ),
        message_kind="generate_result",
    )
    db.add(user_message)
    db.add(assistant_message)

    if task is not None:
        task.article_id = article.id
        task.status = "in_progress"
        if task.assigned_user_id is None and user.employee_id == task.assigned_employee_id:
            task.assigned_user_id = user.id

    _sync_article_images(db, article.id, article.body_content)
    db.commit()
    db.refresh(article)
    db.refresh(user_message)
    db.refresh(assistant_message)
    for source in sources:
        db.refresh(source)

    return NewsletterGenerateResponse(
        article_id=article.id,
        title=article.title,
        content_format=article.content_format,
        topic=article.topic,
        template_style=article.template_style,
        author_user_id=article.author_user_id,
        author_name=user.name,
        body_content=article.body_content,
        sources=[ArticleSourceResponse.model_validate(source) for source in sources],
        messages=[
            ArticleAIMessageResponse.model_validate(user_message),
            ArticleAIMessageResponse.model_validate(assistant_message),
        ],
        warnings=final_warnings,
    )


def list_newsletters(*, db: Session, author_user_id: UUID | None = None) -> NewsletterListResponse:
    articles = _list_articles_filtered(db=db, author_user_id=author_user_id)
    thumbnails = _get_thumbnail_map(db, [article.id for article in articles])
    author_map = _get_author_map(
        db,
        [article.author_user_id for article in articles if article.author_user_id is not None],
    )
    return NewsletterListResponse(
        items=[
            NewsletterListItemResponse(
                article_id=article.id,
                title=article.title,
                content_format=article.content_format,
                topic=article.topic,
                template_style=article.template_style,
                author_user_id=article.author_user_id,
                author_name=author_map[article.author_user_id].name
                if article.author_user_id in author_map
                else None,
                thumbnail_image_url=thumbnails.get(article.id),
                summary=_extract_summary(article.body_content),
                created_at=article.created_at,
                updated_at=article.updated_at,
            )
            for article in articles
        ]
    )


async def upload_newsletter_editor_image(
    *,
    db: Session,
    article_id: UUID,
    file: UploadFile,
) -> NewsletterImageUploadResponse:
    article = _get_article(db, article_id)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported for editor uploads.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    uploaded_url = upload_newsletter_asset(
        file_name=file.filename or "editor-upload.bin",
        content_type=file.content_type or "application/octet-stream",
        content=content,
        entity_key=f"article-{article.id}",
    )
    return NewsletterImageUploadResponse(image_url=uploaded_url)


def get_newsletter_detail(*, db: Session, article_id: UUID) -> NewsletterDetailResponse:
    article = _get_article(db, article_id)
    sources = _list_sources(db, article_id)
    messages = _list_messages(db, article_id)
    author = None
    if article.author_user_id is not None:
        author = db.scalar(
            select(User).where(
                User.id == article.author_user_id,
                User.deleted_at.is_(None),
            )
        )
    return NewsletterDetailResponse(
        article_id=article.id,
        content_format=article.content_format,
        topic=article.topic,
        template_style=article.template_style,
        title=article.title,
        author_user_id=article.author_user_id,
        author_name=author.name if author else None,
        body_content=article.body_content,
        sources=[ArticleSourceResponse.model_validate(source) for source in sources],
        messages=[ArticleAIMessageResponse.model_validate(message) for message in messages],
        created_at=article.created_at,
        updated_at=article.updated_at,
    )


def get_newsletter_messages(*, db: Session, article_id: UUID) -> NewsletterMessagesResponse:
    _get_article(db, article_id)
    messages = _list_messages(db, article_id)
    return NewsletterMessagesResponse(
        article_id=article_id,
        messages=[ArticleAIMessageResponse.model_validate(message) for message in messages],
    )


def assistant_chat(*, db: Session, article_id: UUID, message: str) -> tuple[ArticleAIMessage, ArticleAIMessage]:
    article = _get_article(db, article_id)
    sources = _list_sources(db, article_id)
    messages = _list_messages(db, article_id)

    user_message = ArticleAIMessage(
        article_id=article.id,
        role="user",
        message_text=message,
        message_kind="chat",
    )
    db.add(user_message)
    db.flush()

    result = answer_newsletter_question(
        article_title=article.title,
        body_content=article.body_content,
        sources=_serialize_sources(sources),
        recent_messages=_serialize_messages(messages),
        message=message,
    )
    assistant_message = ArticleAIMessage(
        article_id=article.id,
        role="assistant",
        message_text=result.get("assistantMessage", ""),
        message_kind="chat_result",
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)
    return user_message, assistant_message


async def assistant_edit(
    *,
    db: Session,
    article_id: UUID,
    message: str,
) -> tuple[ArticleAIMessage, ArticleAIMessage, Article]:
    article = _get_article(db, article_id)
    sources = _list_sources(db, article_id)
    messages = _list_messages(db, article_id)

    user_message = ArticleAIMessage(
        article_id=article.id,
        role="user",
        message_text=message,
        message_kind="edit_request",
    )
    db.add(user_message)
    db.flush()

    result = edit_newsletter_content(
        article_title=article.title,
        content_format=article.content_format,
        template_style=article.template_style,
        body_content=article.body_content,
        sources=_serialize_sources(sources),
        recent_messages=_serialize_messages(messages),
        message=message,
    )
    await _materialize_generated_images(
        body_content=result["bodyContent"],
        article_title=result.get("title") or article.title,
        content_format=article.content_format,
        template_style=article.template_style,
        entity_key=f"article-{article.id}",
    )

    article.title = result.get("title") or article.title
    article.topic = result.get("topic")
    article.body_content = result["bodyContent"]
    article.generation_meta = {
        **(article.generation_meta or {}),
        "last_edit_message": message,
        "last_edit_model": "gemini-2.5-flash",
    }

    assistant_message = ArticleAIMessage(
        article_id=article.id,
        role="assistant",
        message_text=result.get("assistantMessage", "I updated the article based on your request."),
        message_kind="edit_result",
    )
    db.add(assistant_message)
    _sync_article_images(db, article.id, article.body_content)
    db.commit()
    db.refresh(article)
    db.refresh(user_message)
    db.refresh(assistant_message)
    return user_message, assistant_message, article


def save_newsletter(
    *,
    db: Session,
    article_id: UUID,
    title: str | None,
    body_content: dict[str, Any],
) -> NewsletterSaveResponse:
    article = _get_article(db, article_id)
    if _has_inline_image_data(body_content):
        raise HTTPException(
            status_code=400,
            detail="Inline base64 images are not supported. Upload editor images first and store their S3 URLs in bodyContent.",
        )
    article.title = title
    article.body_content = body_content
    article.generation_meta = {
        **(article.generation_meta or {}),
        "last_manual_save": datetime.now().isoformat(),
    }
    _sync_article_images(db, article.id, body_content)
    db.commit()
    db.refresh(article)
    return NewsletterSaveResponse(
        article_id=article.id,
        title=article.title,
        body_content=article.body_content,
        updated_at=article.updated_at,
    )


# ── 파이프라인 자동화 DB 저장 ──────────────────────────────

_PIPELINE_TOPIC_MAP = {
    "it": "it",
    "auto": "automotive",
    "kcc": "company",
    "keyword": "it",
}

_PIPELINE_TITLE_MAP = {
    "it": "IT 뉴스레터",
    "auto": "자동차 뉴스레터",
    "kcc": "KCC 소식지",
    "keyword": "뉴스레터",
}

# 프론트가 "template / headerFooter" 형식으로 파싱하므로 맞춰줌
_PIPELINE_TEMPLATE_STYLE_MAP = {
    "it": "뉴스레터 / KCC 모던형",
    "auto": "뉴스레터 / KCC 모던형",
    "kcc": "뉴스레터 / KCC 모던형",
    "keyword": "뉴스레터 / KCC 모던형",
}

_gemini_client = genai.Client(api_key=settings.gemini_api_key)


def _generate_pipeline_title(content: Any, newsletter_type: str) -> str:
    """뉴스레터 기사 내용을 바탕으로 의미있는 제목을 AI로 생성. 실패 시 날짜 기반 제목 반환."""
    today = datetime.now().strftime("%Y-%m-%d")
    fallback = f"{_PIPELINE_TITLE_MAP.get(newsletter_type, '뉴스레터')} {today}"
    try:
        headlines = [getattr(a, "headline", "") for a in content.articles if getattr(a, "headline", "")]
        intro = getattr(content, "intro", "") or ""
        prompt = (
            f"다음은 이번 주 뉴스레터에 담긴 기사 제목들입니다:\n"
            + "\n".join(f"- {h}" for h in headlines)
            + (f"\n\n인트로: {intro}" if intro else "")
            + "\n\n이 뉴스레터 전체를 아우르는 제목을 한 문장으로 만들어주세요. "
            "날짜나 '뉴스레터'라는 단어는 포함하지 말고, 핵심 트렌드나 키워드가 드러나는 간결한 문장으로 작성하세요. "
            "제목만 출력하세요 (따옴표 없이)."
        )
        response = _gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        title = (response.text or "").strip().strip('"').strip("'")
        return title if title else fallback
    except Exception:
        logger.warning("파이프라인 뉴스레터 제목 생성 실패, 기본 제목 사용")
        return fallback


def _resolve_image_urls(images: list) -> list[str | None]:
    """이미지 목록에서 HTTP URL만 추출. 파이프라인에서 이미 S3 업로드가 완료된 상태."""
    resolved: list[str | None] = []
    for img in images:
        img_type = getattr(img, "type", None)
        url = getattr(img, "url", None)
        resolved.append(url if (img_type == "og" and url and url.startswith("http")) else None)
    return resolved


def _pipeline_content_to_tiptap(content: Any, resolved_image_urls: list[str | None]) -> dict:
    """pipeline NewsletterContent → TipTap body_content 변환"""
    blocks: list[dict] = []

    intro = getattr(content, "intro", None)
    if intro:
        blocks.append({"type": "paragraph", "content": [{"type": "text", "text": intro}]})

    for i, article in enumerate(content.articles):
        img_url: str | None = resolved_image_urls[i] if i < len(resolved_image_urls) else None

        if img_url:
            # image는 TipTap에서 블록 노드 → doc.content 최상위에 위치해야 함
            blocks.append({
                "type": "image",
                "attrs": {"src": img_url, "alt": article.headline},
            })

        blocks.append({
            "type": "heading",
            "attrs": {"level": 2},
            "content": [{"type": "text", "text": article.headline}],
        })

        if article.body:
            blocks.append({"type": "paragraph", "content": [{"type": "text", "text": article.body}]})

        if article.original_link:
            blocks.append({
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": "원문 보기",
                    "marks": [{"type": "link", "attrs": {"href": article.original_link, "target": "_blank"}}],
                }],
            })

    return {"type": "doc", "content": blocks}


def save_pipeline_newsletter_to_db(
    *,
    content: Any,
    images: list,
    newsletter_type: str,
    newsletter_file_id: str,
    recipient_categories: list[str] | None = None,
    recipient_count: int = 0,
    title: str | None = None,
) -> str | None:
    """실제 발송된 파이프라인 뉴스레터를 articles 테이블에 저장. 실패해도 발송 결과에 영향 없음."""
    from src.db import SessionLocal

    if not title:
        title = _generate_pipeline_title(content, newsletter_type)
    topic = _PIPELINE_TOPIC_MAP.get(newsletter_type, "it")
    template_style = _PIPELINE_TEMPLATE_STYLE_MAP.get(newsletter_type, "뉴스레터 / KCC 모던형")
    resolved_urls = _resolve_image_urls(images)
    body_content = _pipeline_content_to_tiptap(content, resolved_urls)

    article = Article(
        content_format="newsletter",
        topic=topic,
        template_style=template_style,
        title=title,
        body_content=body_content,
        generation_meta={
            "source": "pipeline",
            "pipeline_type": newsletter_type,
            "pipeline_status": "sent",
            "newsletter_file_id": newsletter_file_id,
            "sent_at": datetime.now().isoformat(),
            "article_count": len(content.articles),
            "recipient_categories": recipient_categories or [],
            "recipient_count": recipient_count,
        },
        author_user_id=None,
    )

    db = SessionLocal()
    try:
        db.add(article)
        db.flush()
        _sync_article_images(db, article.id, body_content)
        db.commit()
        db.refresh(article)
        logger.info("파이프라인 뉴스레터 DB 저장 완료: article_id=%s, file_id=%s", article.id, newsletter_file_id)
        return str(article.id)
    except Exception:
        db.rollback()
        logger.exception("파이프라인 뉴스레터 DB 저장 실패 (file_id=%s)", newsletter_file_id)
        return None
    finally:
        db.close()


def update_pipeline_newsletter_status(*, newsletter_file_id: str, status: str) -> None:
    """newsletter_file_id로 파이프라인 뉴스레터 상태 업데이트 (sent / rejected)"""
    from src.db import SessionLocal

    db = SessionLocal()
    try:
        article = db.scalar(
            select(Article).where(
                Article.generation_meta["newsletter_file_id"].astext == newsletter_file_id,
                Article.deleted_at.is_(None),
            )
        )
        if article is None:
            logger.warning("파이프라인 article 없음 (newsletter_file_id=%s)", newsletter_file_id)
            return

        meta = dict(article.generation_meta or {})
        meta["pipeline_status"] = status
        if status == "sent":
            meta["sent_at"] = datetime.now().isoformat()
        elif status == "rejected":
            meta["rejected_at"] = datetime.now().isoformat()
        article.generation_meta = meta
        db.commit()
        logger.info("파이프라인 상태 업데이트: %s → %s", newsletter_file_id, status)
    except Exception:
        db.rollback()
        logger.exception("파이프라인 상태 업데이트 실패 (newsletter_file_id=%s)", newsletter_file_id)
    finally:
        db.close()


def delete_newsletter(*, db: Session, article_id: UUID) -> NewsletterDeleteResponse:
    article = _get_article(db, article_id)
    deleted_at = datetime.now()

    article.deleted_at = deleted_at

    images = list(
        db.scalars(
            select(ArticleImage).where(
                ArticleImage.article_id == article_id,
                ArticleImage.deleted_at.is_(None),
            )
        )
    )
    for image in images:
        image.deleted_at = deleted_at

    sources = list(
        db.scalars(
            select(ArticleSource).where(
                ArticleSource.article_id == article_id,
                ArticleSource.deleted_at.is_(None),
            )
        )
    )
    for source in sources:
        source.deleted_at = deleted_at

    linked_tasks = list(
        db.scalars(
            select(ContentTask).where(
                ContentTask.article_id == article_id,
                ContentTask.deleted_at.is_(None),
            )
        )
    )
    for task in linked_tasks:
        task.article_id = None
        task.status = "pending"
        task.completed_at = None

    db.commit()
    db.refresh(article)

    return NewsletterDeleteResponse(
        article_id=article.id,
        deleted_at=article.deleted_at,
        message="Article deleted successfully.",
    )
