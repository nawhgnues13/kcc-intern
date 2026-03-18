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
    """원문 URL에서 OG 이미지 추출"""
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
            # 이미지 접근 가능 여부 확인
            check = await http_client.head(og_url, timeout=3.0)
            if check.status_code == 200:
                return og_url
    except Exception as e:
        logger.debug(f"OG 이미지 추출 실패 [{url}]: {e}")
    return None


async def generate_image(prompt: str) -> bytes:
    """Gemini API로 이미지 생성"""
    response = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
            return part.inline_data.data

    raise Exception("이미지 데이터를 찾을 수 없음")


async def extract_content_image(url: str) -> str | None:
    """본문 첫 번째 <img> 추출 (OG 이미지 대신 실제 기사 이미지가 필요한 경우)"""
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
    except Exception as e:
        logger.debug(f"본문 이미지 추출 실패 [{url}]: {e}")
    return None


async def get_article_image(
    article_url: str,
    image_prompt: str,
    save_path: str,
) -> ImageInfo:
    """기사 이미지 확보: OG 이미지 우선, 없으면 Gemini 생성"""
    # 1차: OG 이미지 시도
    og_url = await extract_og_image(article_url)
    if og_url:
        logger.info(f"OG 이미지 사용: {og_url[:60]}...")
        return ImageInfo(type="og", url=og_url)

    # 2차: Gemini 이미지 생성
    if image_prompt:
        try:
            image_bytes = await generate_image(image_prompt)
            save_file = Path(save_path)
            save_file.parent.mkdir(parents=True, exist_ok=True)
            save_file.write_bytes(image_bytes)
            logger.info(f"Gemini 이미지 생성 완료: {save_path}")
            return ImageInfo(type="generated", file_path=save_path)
        except Exception as e:
            logger.warning(f"Gemini 이미지 생성 실패: {e}")

    # Fallback: 이미지 없음
    return ImageInfo(type="none")
