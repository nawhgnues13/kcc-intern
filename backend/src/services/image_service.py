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
        logger.info("Using OG image: %s...", og_url[:60])
        return ImageInfo(type="og", url=og_url)

    if image_prompt:
        try:
            image_bytes = await generate_image(image_prompt)
            save_file = Path(save_path)
            save_file.parent.mkdir(parents=True, exist_ok=True)
            save_file.write_bytes(image_bytes)
            logger.info("Generated article image: %s", save_path)
            return ImageInfo(type="generated", file_path=save_path)
        except Exception as exc:
            logger.warning("Failed to generate article image: %s", exc)

    return ImageInfo(type="none")
