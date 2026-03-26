from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile

from src.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_NEWSLETTER_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
}


def _get_s3_client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        endpoint_url=settings.aws_s3_endpoint_url or None,
    )


def is_s3_configured() -> bool:
    return bool(
        settings.aws_access_key_id
        and settings.aws_secret_access_key
        and settings.aws_region
        and settings.aws_s3_bucket
    )


def _build_object_url(object_key: str) -> str:
    endpoint_base = settings.aws_s3_endpoint_url.rstrip("/") if settings.aws_s3_endpoint_url else ""
    if endpoint_base:
        return f"{endpoint_base}/{settings.aws_s3_bucket}/{object_key}"
    return f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{object_key}"


def _extract_object_key_from_url(url: str) -> str | None:
    if not url:
        return None

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return None

    bucket = settings.aws_s3_bucket
    if not bucket:
        return None

    path = unquote(parsed.path.lstrip("/"))
    netloc = (parsed.netloc or "").lower()

    if netloc.startswith(f"{bucket}.s3.") or netloc == f"{bucket}.amazonaws.com":
        return path or None

    if settings.aws_s3_endpoint_url:
        endpoint = urlparse(settings.aws_s3_endpoint_url)
        endpoint_host = (endpoint.netloc or "").lower()
        if netloc == endpoint_host:
            bucket_prefix = f"{bucket}/"
            if path.startswith(bucket_prefix):
                return path[len(bucket_prefix):] or None

    return None


def _put_object(*, object_key: str, content: bytes, content_type: str) -> str:
    try:
        client = _get_s3_client()
        client.put_object(
            Bucket=settings.aws_s3_bucket,
            Key=object_key,
            Body=content,
            ContentType=content_type,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(status_code=500, detail="Failed to upload file to S3.") from exc

    return _build_object_url(object_key)


def get_private_object_from_url(url: str) -> tuple[bytes, str, str] | None:
    object_key = _extract_object_key_from_url(url)
    if not object_key:
        return None

    try:
        client = _get_s3_client()
        response = client.get_object(Bucket=settings.aws_s3_bucket, Key=object_key)
    except (BotoCoreError, ClientError):
        return None

    body = response["Body"].read()
    content_type = response.get("ContentType") or "application/octet-stream"
    filename = Path(object_key).name or "download"
    return body, content_type, filename


def generate_presigned_read_url_from_url(url: str, expires_in: int = 3600) -> str | None:
    object_key = _extract_object_key_from_url(url)
    if not object_key:
        return None

    try:
        client = _get_s3_client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.aws_s3_bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )
    except (BotoCoreError, ClientError):
        return None


def upload_newsletter_asset(
    *,
    file_name: str,
    content_type: str,
    content: bytes,
    entity_key: str,
) -> str:
    if not is_s3_configured():
        raise HTTPException(status_code=500, detail="S3 configuration is incomplete.")
    if content_type not in ALLOWED_NEWSLETTER_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and image files are supported.")
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    extension = Path(file_name or "upload").suffix.lower() or ".bin"
    object_key = f"{settings.aws_s3_newsletter_prefix}/{entity_key}/{uuid4()}{extension}"
    return _put_object(object_key=object_key, content=content, content_type=content_type)


def upload_pipeline_image(*, image_bytes: bytes, object_key: str, content_type: str = "image/png") -> str:
    """파이프라인 이미지를 S3에 업로드하고 presigned URL 반환. S3 미설정 시 빈 문자열 반환."""
    import logging as _logging
    _logger = _logging.getLogger(__name__)

    if not is_s3_configured():
        return ""

    s3 = _get_s3_client()
    try:
        s3.put_object(
            Bucket=settings.aws_s3_bucket,
            Key=object_key,
            Body=image_bytes,
            ContentType=content_type,
        )
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.aws_s3_bucket, "Key": object_key},
            ExpiresIn=604800,  # 7일
        )
        _logger.info("파이프라인 이미지 S3 업로드 완료: %s...", presigned_url[:80])
        return presigned_url
    except Exception as exc:
        _logger.warning("S3 업로드 실패: %s", exc)
        return ""


async def upload_profile_image(file: UploadFile, entity_key: str) -> str:
    if not is_s3_configured():
        raise HTTPException(status_code=500, detail="S3 configuration is incomplete.")
    if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only jpg, png, webp, and gif images are supported.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    extension = Path(file.filename or "upload").suffix.lower() or ".bin"
    object_key = f"{settings.aws_s3_profile_image_prefix}/{entity_key}/{uuid4()}{extension}"
    return _put_object(object_key=object_key, content=content, content_type=file.content_type)
