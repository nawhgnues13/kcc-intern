import json
import tempfile
from pathlib import Path
from typing import Any

import httpx
from google import genai
from google.genai import types

from src.config import settings

MODEL_NAME = "gemini-2.5-flash"
ALLOWED_TOPICS = {"automotive", "it", "company"}

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """You are a professional newsletter editor.
Analyze the user's request together with any attached PDFs, images, and URLs.
Write a readable, substantial Korean article.
Do not return plain prose only. Mix heading, paragraph, quote, and image blocks when helpful.
Return only valid JSON.
Never invent arbitrary public placeholder image URLs.
Never return local placeholder file names such as attached_image_1.png, image1.png, or similar.
If you want an image block but do not have a reliable attached source URL, set src to an empty string and describe the image in alt.

The JSON shape must be:
{
  "title": "string",
  "topic": "automotive | it | company | null",
  "assistantMessage": "short Korean explanation of what you produced",
  "warnings": ["optional warning strings"],
  "bodyContent": {
    "type": "doc",
    "content": [
      { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "..." }] },
      { "type": "paragraph", "content": [{ "type": "text", "text": "..." }] },
      { "type": "quote", "content": [{ "type": "text", "text": "..." }] },
      { "type": "image", "attrs": { "src": "https://...", "alt": "..." } }
    ]
  }
}
"""

CHAT_SYSTEM_INSTRUCTION = """You are an AI assistant helping explain a newsletter article.
Answer in Korean.
Do not rewrite the article.
Return only valid JSON:
{
  "assistantMessage": "string"
}
"""

EDIT_SYSTEM_INSTRUCTION = """You are an AI assistant editing a newsletter article.
The user may ask for a partial edit or a full regeneration.
Reuse the current article and attached sources.
Return only valid JSON:
Never invent arbitrary public placeholder image URLs.
Never return local placeholder file names such as attached_image_1.png, image1.png, or similar.
If you want an image block but do not have a reliable attached source URL, set src to an empty string and describe the image in alt.
{
  "title": "string",
  "topic": "automotive | it | company | null",
  "assistantMessage": "short Korean explanation of the edit",
  "bodyContent": {
    "type": "doc",
    "content": []
  }
}
"""


def _strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2:
            cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return cleaned.strip()


def _parse_json_response(text: str) -> dict[str, Any]:
    return json.loads(_strip_json_fences(text))


def _normalize_topic(topic: str | None) -> str | None:
    return topic if topic in ALLOWED_TOPICS else None


def _serialize_recent_messages(messages: list[dict[str, Any]]) -> str:
    return json.dumps(messages[-8:], ensure_ascii=False, indent=2)


def _serialize_body_content(body_content: dict[str, Any]) -> str:
    return json.dumps(body_content, ensure_ascii=False, indent=2)


def upload_inline_file(file_name: str, content: bytes) -> Any:
    suffix = Path(file_name).suffix or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(content)
        temp_path = Path(temp_file.name)

    try:
        return client.files.upload(file=temp_path)
    finally:
        temp_path.unlink(missing_ok=True)


def _download_remote_file(url: str) -> tuple[bytes, str]:
    response = httpx.get(url, timeout=30.0, follow_redirects=True)
    response.raise_for_status()
    return response.content, response.headers.get("content-type", "application/octet-stream")


def _rehydrate_source_file(source: dict[str, Any]) -> Any | None:
    storage_url = source.get("storage_url")
    mime_type = source.get("mime_type") or ""
    if not storage_url or not (mime_type.startswith("image/") or mime_type == "application/pdf"):
        return None

    file_name = source.get("original_name") or Path(storage_url).name or "source.bin"
    content, _ = _download_remote_file(storage_url)
    return upload_inline_file(file_name, content)


def generate_newsletter_content(
    *,
    instruction: str,
    content_format: str,
    template_style: str,
    urls: list[str],
    uploaded_files: list[Any],
) -> dict[str, Any]:
    url_lines = "\n".join(f"- {url}" for url in urls) if urls else "- none"
    prompt = f"""
Create a {content_format} article using the template style "{template_style}".

User instruction:
{instruction}

URLs to consult with URL Context:
{url_lines}

If an image block is useful, use an attached image source URL when available.
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[prompt, *uploaded_files],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            tools=[{"url_context": {}}] if urls else None,
        ),
    )

    parsed = _parse_json_response(response.text)
    parsed["topic"] = _normalize_topic(parsed.get("topic"))
    parsed["warnings"] = parsed.get("warnings") or []
    return parsed


def answer_newsletter_question(
    *,
    article_title: str | None,
    body_content: dict[str, Any],
    sources: list[dict[str, Any]],
    recent_messages: list[dict[str, Any]],
    message: str,
) -> dict[str, Any]:
    prompt = f"""
Current article title: {article_title or ""}

Current article body:
{_serialize_body_content(body_content)}

Attached sources summary:
{json.dumps(sources, ensure_ascii=False, indent=2)}

Recent messages:
{_serialize_recent_messages(recent_messages)}

User question:
{message}
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=CHAT_SYSTEM_INSTRUCTION),
    )
    return _parse_json_response(response.text)


def edit_newsletter_content(
    *,
    article_title: str | None,
    content_format: str,
    template_style: str,
    body_content: dict[str, Any],
    sources: list[dict[str, Any]],
    recent_messages: list[dict[str, Any]],
    message: str,
) -> dict[str, Any]:
    url_sources: list[str] = []
    rehydrated_files: list[Any] = []

    for source in sources:
        if source.get("source_type") == "url" and source.get("source_url"):
            url_sources.append(source["source_url"])
            continue

        uploaded = _rehydrate_source_file(source)
        if uploaded is not None:
            rehydrated_files.append(uploaded)

    url_lines = "\n".join(f"- {url}" for url in url_sources) if url_sources else "- none"
    prompt = f"""
Current article title: {article_title or ""}
Content format: {content_format}
Template style: {template_style}

Current article body:
{_serialize_body_content(body_content)}

URLs to consult again with URL Context:
{url_lines}

Recent messages:
{_serialize_recent_messages(recent_messages)}

User edit request:
{message}
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[prompt, *rehydrated_files],
        config=types.GenerateContentConfig(
            system_instruction=EDIT_SYSTEM_INSTRUCTION,
            tools=[{"url_context": {}}] if url_sources else None,
        ),
    )
    parsed = _parse_json_response(response.text)
    parsed["topic"] = _normalize_topic(parsed.get("topic"))
    return parsed
