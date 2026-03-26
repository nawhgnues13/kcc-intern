import logging
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import ImageInfo

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)


async def extract_og_image(url: str) -> str | None:
    """Extract an Open Graph image URL from a public web page."""
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as http_client:
            response = await http_client.get(url)
            soup = BeautifulSoup(response.text, "html.parser")
            og_tag = soup.find("meta", property="og:image")
            if not og_tag:
                return None

            og_url = og_tag.get("content", "")
            if not og_url.startswith("http"):
                return None

            check = await http_client.head(og_url, timeout=3.0)
            if check.status_code == 200:
                return og_url
    except Exception as exc:
        logger.debug("Failed to extract OG image from %s: %s", url, exc)
    return None


async def generate_image(prompt: str) -> bytes:
    """Generate an image with Gemini and return raw bytes."""
    response = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        raise RuntimeError("Gemini image response did not include any candidates.")

    parts = getattr(candidates[0].content, "parts", None) or []
    for part in parts:
        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
            return part.inline_data.data

    raise RuntimeError("Gemini image response did not include image data.")


async def extract_content_image(url: str) -> str | None:
    """Extract the first content image from a public article page."""
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as http_client:
            response = await http_client.get(url)
            soup = BeautifulSoup(response.text, "html.parser")
            content = (
                soup.find("div", class_="entry-content")
                or soup.find("div", class_="post-content")
                or soup.find("article")
            )
            if not content:
                return None

            img_tag = content.find("img")
            if not img_tag:
                return None

            src = img_tag.get("src", "")
            if src.startswith("http"):
                return src
    except Exception as exc:
        logger.debug("Failed to extract content image from %s: %s", url, exc)
    return None


async def get_article_image(
    article_url: str,
    image_prompt: str,
    save_path: str,
) -> ImageInfo:
    """Pick an article image from OG metadata or generate one with Gemini."""
    og_url = await extract_og_image(article_url)
    if og_url:
        logger.debug("OG 이미지 사용: %s...", og_url[:60])
        return ImageInfo(type="og", url=og_url)

    if image_prompt:
        try:
            image_bytes = await generate_image(image_prompt)
            save_file = Path(save_path)
            save_file.parent.mkdir(parents=True, exist_ok=True)
            save_file.write_bytes(image_bytes)
            logger.debug("Gemini 이미지 생성: %s", save_path)
            return ImageInfo(type="generated", file_path=save_path)
        except Exception as exc:
            logger.warning("이미지 생성 실패: %s", exc)

    return ImageInfo(type="none")


async def upload_image_to_s3(img: ImageInfo, object_key: str) -> ImageInfo:
    """OG/generated 이미지를 모두 S3에 업로드하고 S3 URL로 교체. 실패 시 원본 반환.

    - og: 외부 URL에서 바이트 다운로드 후 S3 업로드 (핫링크 차단 우회)
    - generated: 로컬 파일 읽어서 S3 업로드
    """
    from src.services.s3_service import upload_pipeline_image

    image_bytes: bytes | None = None
    ext = "png"

    if img.type == "og" and img.url:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                r = await client.get(img.url)
                if r.status_code == 200:
                    image_bytes = r.content
                    url_path = img.url.rsplit("?", 1)[0]
                    ext = url_path.rsplit(".", 1)[-1].lower()
                    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
                        ext = "jpg"
        except Exception as exc:
            logger.warning("OG 이미지 다운로드 실패: %s", exc)

    elif img.type == "generated" and img.file_path:
        try:
            image_bytes = Path(img.file_path).read_bytes()
        except Exception as exc:
            logger.warning("생성 이미지 파일 읽기 실패: %s", exc)

    if not image_bytes:
        return img

    # object_key에 확장자가 없으면 붙이고, content_type도 정확하게 전달
    ext_to_ct = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}
    content_type = ext_to_ct.get(ext, "image/jpeg")
    full_key = f"{object_key}.{ext}" if not object_key.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")) else object_key

    try:
        s3_url = upload_pipeline_image(image_bytes=image_bytes, object_key=full_key, content_type=content_type)
        if s3_url:
            logger.debug("이미지 S3 업로드 완료: %s", s3_url[:80])
            return ImageInfo(type="og", url=s3_url)
    except Exception as exc:
        logger.warning("S3 업로드 실패, 원본 유지: %s", exc)

    return img
