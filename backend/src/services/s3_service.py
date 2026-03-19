from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile

from src.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


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


async def upload_profile_image(file: UploadFile, entity_key: str) -> str:
    if not is_s3_configured():
        raise HTTPException(status_code=500, detail="S3 설정이 완료되지 않았습니다.")

    if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="jpg, png, webp, gif 이미지 파일만 업로드할 수 있습니다.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")

    extension = Path(file.filename or "upload").suffix.lower() or ".bin"
    object_key = f"{settings.aws_s3_profile_image_prefix}/{entity_key}/{uuid4()}{extension}"

    try:
        client = _get_s3_client()
        client.put_object(
            Bucket=settings.aws_s3_bucket,
            Key=object_key,
            Body=content,
            ContentType=file.content_type,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(status_code=500, detail="프로필 이미지를 S3에 업로드하지 못했습니다.") from exc

    endpoint_base = settings.aws_s3_endpoint_url.rstrip("/") if settings.aws_s3_endpoint_url else ""
    if endpoint_base:
        return f"{endpoint_base}/{settings.aws_s3_bucket}/{object_key}"

    return f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{object_key}"
