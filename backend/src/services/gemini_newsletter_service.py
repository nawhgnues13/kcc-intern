import json
import logging
import tempfile
from pathlib import Path
from typing import Any

import httpx
from google import genai
from google.genai import types
from json_repair import repair_json

from src.config import settings

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-2.5-flash"
ALLOWED_TOPICS = {"automotive", "it", "company", "pet"}

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """You are a professional Korean content editor.
Analyze the user's request together with any attached PDFs, images, and URLs.
Write a readable, substantial Korean article in the requested format.
Do not return plain prose only. Mix heading, paragraph, quote, and image blocks when helpful.
Return only valid JSON.
Never invent arbitrary public placeholder image URLs.
Never return local placeholder file names such as attached_image_1.png, image1.png, or similar.
If you want an image block but do not have a reliable attached source URL, set src to an empty string and describe the image in alt.
For blog content, it is acceptable to include lightweight markdown-style emphasis such as **bold** inside text nodes when it improves later rendering.

The JSON shape must be:
{
  "title": "string",
  "topic": "automotive | it | company | pet | null",
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
  },
  "platformOutput": {
    "platform": "instagram",
    "postText": "string",
    "hashtags": ["#tag1", "#tag2"],
    "imageDownloadUrls": ["https://..."]
  }
}

Only include platformOutput when the requested content format is instagram.
"""

CHAT_SYSTEM_INSTRUCTION = """You are an AI assistant helping explain an article.
Answer in Korean.
Do not rewrite the article.
Return only valid JSON:
{
  "assistantMessage": "string"
}
"""

EDIT_SYSTEM_INSTRUCTION = """You are an AI assistant editing an article.
The user may ask for a partial edit or a full regeneration.
Reuse the current article and attached sources.
Return only valid JSON:
Never invent arbitrary public placeholder image URLs.
Never return local placeholder file names such as attached_image_1.png, image1.png, or similar.
If you want an image block but do not have a reliable attached source URL, set src to an empty string and describe the image in alt.
{
  "title": "string",
  "topic": "automotive | it | company | pet | null",
  "assistantMessage": "short Korean explanation of the edit",
  "bodyContent": {
    "type": "doc",
    "content": []
  },
  "platformOutput": {
    "platform": "instagram",
    "postText": "string",
    "hashtags": ["#tag1", "#tag2"],
    "imageDownloadUrls": ["https://..."]
  }
}

Only include platformOutput when the current article format is instagram.
"""

BLOG_TEMPLATE_GUIDANCE = {
    "blog_naver_basic": """
- This is a Korean blog post intended for Naver-style copy/paste publishing.
- The result should feel lively, polished, and blog-like rather than formal or report-like.
- Build structured content that can later be rendered into an eye-catching copy-paste post.
- Use short mobile-friendly paragraphs, varied rhythm, and occasional one-line emphasis paragraphs.
- Add emoji to the main title and section headings when helpful, but do not overuse them.
- Very early in the article, include a quote block that works like a '핵심 요약' box.
- Include at least one checklist or practical checkpoint section that can later render as a checklist.
- Include at least one section heading phrased like a question, checklist, or practical takeaway.
- Make image blocks and their alt text useful for later "image position + caption" rendering.
- You may include lightweight markdown-style emphasis such as **bold** inside text nodes when it improves scanability.
- Favor practical, readable, slightly energetic blog flow over neutral article tone.
- The article should feel close to this pattern: strong hook -> fast summary -> rhythmic sections -> image placeholder -> checklist -> warm CTA.
""".strip(),
    "blog_html": """
- This is a Korean blog post intended to be rendered into semantic HTML.
- Write with clean section hierarchy, descriptive headings, compact paragraphs, and quote blocks that map neatly to HTML.
- Prefer clear editorial grouping, distinct section purposes, and text that converts well into headings, paragraphs, lists, and figure captions.
- Make each major section feel like it could later become a distinct visual block, content card, summary panel, or hero section in HTML.
- Include at least one quote block that can later become a highlighted summary box.
- Include at least one list-friendly or checklist-friendly section that can later become a clean HTML list or card group.
- Use image blocks with elegant, descriptive alt text so they can become figure captions naturally.
- Favor polished editorial tone with readable energy, not dry report tone.
- Think in terms of section architecture: intro section, summary section, explainer section, practical takeaway section, closing CTA.
""".strip(),
    "blog_markdown": """
- This is a Korean blog post intended to be rendered into Markdown.
- Write with strong heading hierarchy, compact paragraphs, quote-ready callouts, and list-friendly sections.
- Make the structure easy to convert into Markdown headings, bullet lists, blockquotes, checklists, and image captions.
- Use crisp section boundaries and scannable phrasing.
- Include at least one quote block that can later become a Markdown blockquote summary.
- Include at least one practical list/checkpoint section that will read naturally as Markdown bullets or checklist items.
- Favor clean, well-organized, document-like blog flow over decorative wording.
- Keep wording concise and readable, with occasional emphasis points that work well in Markdown export.
- The article should feel like a polished blog post that is also easy to read as a technical note or guide.
    """.strip(),
}

INSTAGRAM_TEMPLATE_GUIDANCE = """
- This is a Korean Instagram feed or carousel post for a brand account.
- Return structured bodyContent JSON and also include platformOutput for instagram.
- platformOutput.postText means the text that goes into the Instagram post body, not a per-image caption.
- Start with a strong hook in the first line.
- Make postText easy to read with short lines and natural line breaks.
- Keep the tone social-media friendly, warm, and polished, but not spammy or overly promotional.
- Avoid stiff article/report tone.
- Make the bodyContent itself useful for internal preview and editing, but make platformOutput.postText directly usable for upload.
- Generate hashtags only in a quantity that naturally fits the topic and tone. Do not force a fixed count.
- Avoid repetitive, low-value, or spam-like hashtags.
- imageDownloadUrls should reference the useful image URLs from the article body when available.
- A good flow is: hook -> short value explanation -> practical point -> soft CTA -> hashtags.
""".strip()

CRM_GENERATION_GUIDANCE = """
- This content is being generated from a CRM registration with real business facts and real uploaded photos.
- Treat the CRM source data as the primary source of truth.
- Use the uploaded or registered photos as the visual basis whenever possible.
- Do not invent customer-specific facts, exact prices, exact options, exact repair parts, or exact pet conditions that are not present in the source data.
- If information is missing, write naturally around confirmed facts instead of guessing.
""".strip()

CRM_SOURCE_FORMAT_GUIDANCE = {
    ("sale", "blog"): """
- Write this as a dealership-style vehicle delivery / purchase review blog post.
- The tone should feel like a polished official delivery post, not a random personal diary.
- Center the article around the registered vehicle info, color, trim, branch, and why the vehicle feels attractive or practical.
- If photos include specific detail shots such as wheels, interior, grille, headlights, or delivery ribbon, explain those photos right below or near them.
- If there are many photos, let the article feel photo-led with shorter paragraphs.
- If there are fewer photos, add more readable explanation about model appeal, color/trim combination, option feel, and why the choice makes sense.
- Use search only for stable, directly relevant vehicle facts such as broad model family context, body type, or generally known characteristics. Do not invent exact specs or options unless the CRM source explicitly mentions them.
- End with a dealership-style closing that feels warm and professional, not overly promotional.
""".strip(),
    ("sale", "instagram"): """
- Write this as an official vehicle delivery Instagram post.
- The first line should clearly say what model was delivered or introduced.
- Favor a representative delivery-photo tone over a long article.
- Keep the post concise, readable, and warm, with short line breaks.
- Mention key attractive points such as color, trim, seat combination, or why the customer chose the model when those facts are present.
- If dealer or branch info is in the CRM source, it is acceptable to end with a short professional closing or contact cue.
- Use search only for stable, directly relevant model-family facts. Do not invent exact specs, exact options, or customer-specific motivations.
""".strip(),
    ("service", "blog"): """
- Write this as a repair/service work log style blog post for an auto service shop.
- The flow should feel like: symptom or issue -> diagnosis -> work performed -> result or takeaway.
- Use the repair details in the CRM source as the factual backbone.
- If there are before/after or progress photos, explain what each stage shows near the related image.
- The tone should be trustworthy, clear, and practical rather than emotional or overly salesy.
- If the registered photos are plentiful, let the blog feel like a step-by-step repair record.
- If the photos are limited, strengthen the explanation of the symptom, likely cause, work area, and outcome in a readable way without inventing facts.
- Use search only for stable, directly relevant vehicle or repair context such as a broad explanation of the component or general symptom context. Never invent an exact diagnosis, part replacement, or cost breakdown that is not in the source.
- Close with a practical maintenance or inspection takeaway when natural.
""".strip(),
    ("service", "instagram"): """
- Write this as a concise automotive repair Instagram post.
- Focus on what issue was seen, what area was repaired or restored, and how the result turned out.
- The image sequence may feel like before/after or work-progress photos, so keep the text concise and visually supportive.
- Mention the vehicle model and the repaired area early.
- Keep the tone practical, confident, and shop-like, not like a long blog article.
- Shop/location/contact style closing is acceptable if that fits the source tone.
- Use search only for stable, directly relevant component or model context. Never invent exact repair details not present in the CRM source.
""".strip(),
    ("grooming", "blog"): """
- Write this as a pet salon's own grooming blog post, not as a customer review diary.
- The flow should feel like: pet introduction -> before condition or visit context -> today's grooming style or care focus -> after result -> care tip or warm closing.
- If before/after photos are present, use them actively.
- If photos show face shape, ear line, body length, paw trim, or other styling details, explain those points near the related images.
- The tone should be warm, trustworthy, and salon-owner-like.
- Do not write as if a customer is reviewing the salon. Write as if the salon is introducing today's grooming result.
- If the breed or pet type is known, you may use search for broad and stable grooming-related facts such as coat or styling considerations. Do not invent medical claims, allergy claims, or pet personality details.
- If photos are few, add more useful explanation about the styling point, coat management, home care, or grooming reason.
""".strip(),
    ("grooming", "instagram"): """
- Write this as a pet grooming salon Instagram post.
- The tone should feel cute, polished, and warm, but not childish or spammy.
- Use the after photo as the emotional focal point, and use before/after comparison when available.
- Mention today's grooming point such as face line, ear shape, body length, paw finish, or styling mood when those facts are supported by the source.
- Keep the text concise with soft line breaks and a friendly salon voice.
- If the breed is known, you may use search for broad and stable breed/grooming context, but do not invent medical or temperament claims.
- End with a short warm line or simple CTA that fits an Instagram salon account.
""".strip(),
}


def _build_generation_prompt(
    *,
    instruction: str,
    content_format: str,
    template_style: str,
    urls: list[str],
    source_type: str | None = None,
    enable_google_search: bool = False,
) -> str:
    url_lines = "\n".join(f"- {url}" for url in urls) if urls else "- none"
    blog_guidance = BLOG_TEMPLATE_GUIDANCE.get(template_style)
    crm_source_guidance = CRM_SOURCE_FORMAT_GUIDANCE.get((source_type, content_format))

    prompt_sections = [
        f'Create a {content_format} article using the template style "{template_style}".',
    ]

    if source_type:
        prompt_sections.extend(
            [
                "",
                "CRM generation guidance:",
                CRM_GENERATION_GUIDANCE,
                "",
                f"Business source type: {source_type}",
            ]
        )
        if crm_source_guidance:
            prompt_sections.extend(
                [
                    "",
                    "Source-specific writing guidance:",
                    crm_source_guidance,
                ]
            )
        if enable_google_search:
            prompt_sections.extend(
                [
                    "",
                    "Search usage guidance:",
                    "- You may use Google Search only to fill small factual gaps with broad, stable, directly relevant facts.",
                    "- Prefer facts such as model-family background, body type, general component context, or broad breed/grooming care context.",
                    "- Never invent exact options, exact trim details, exact prices, exact repair work, or exact pet condition details unless they are already present in the CRM source.",
                    "- If search results are unclear, conflicting, or not directly relevant, omit them instead of guessing.",
                ]
            )

    if content_format == "blog" and blog_guidance:
        prompt_sections.extend(
            [
                "",
                "Blog option guidance:",
                blog_guidance,
                "",
                "Important: return structured bodyContent JSON only. Do not return raw HTML or raw Markdown.",
                "The frontend will transform the structured content into the final blog output mode.",
                "For blog output, make the bodyContent itself rich enough that the frontend can later render a visually engaging result.",
                "Use heading, paragraph, quote, and image blocks deliberately rather than producing only plain paragraphs.",
            ]
        )
        if template_style == "blog_naver_basic":
            prompt_sections.extend(
                [
                    "Recommended block rhythm for blog_naver_basic:",
                    "1) Title with light emoji tone",
                    "2) 2-3 short opening paragraphs",
                    "3) One quote block that acts like a '핵심 요약' box",
                    "4) 3-5 main sections with varied heading style",
                    "5) 1 image block in the middle with stylish, useful alt text",
                    "6) 1 practical checklist/checkpoint section",
                    "7) A warm closing paragraph with natural CTA",
                    "When useful, include lines or phrases that can later be rendered as checklist items, summary bullets, or highlighted one-liners.",
                ]
            )
        elif template_style == "blog_html":
            prompt_sections.extend(
                [
                    "Recommended block rhythm for blog_html:",
                    "1) Strong title and concise lead",
                    "2) One quote block that works like a visual summary box",
                    "3) 4-6 clearly separated sections with distinct purposes",
                    "4) At least one section that can later render as a list or card group",
                    "5) 1-2 image blocks with polished caption-ready alt text",
                    "6) A closing section with practical takeaway and CTA",
                    "Think like an editor preparing content for a well-designed HTML article page.",
                ]
            )
        elif template_style == "blog_markdown":
            prompt_sections.extend(
                [
                    "Recommended block rhythm for blog_markdown:",
                    "1) Clear title and direct opening",
                    "2) One quote block that can become a Markdown summary callout",
                    "3) 4-6 sections with crisp, Markdown-friendly heading logic",
                    "4) At least one bullet/checklist-friendly practical section",
                    "5) 1 image block with straightforward caption-ready alt text",
                    "6) A short conclusion and natural CTA",
                    "Think like an editor preparing content that should read well in raw Markdown as well as rendered Markdown.",
                ]
            )
    elif content_format == "instagram":
        prompt_sections.extend(
            [
                "",
                "Instagram option guidance:",
                INSTAGRAM_TEMPLATE_GUIDANCE,
                "",
                "Important: return structured bodyContent JSON and include platformOutput for instagram.",
                "platformOutput.postText must be directly usable as Instagram post body text.",
                "platformOutput.hashtags must be a clean array of hashtag strings.",
                "platformOutput.imageDownloadUrls should include the useful final image URLs when possible.",
                "Recommended structure for instagram:",
                "1) Strong hook in the opening line",
                "2) 2-4 short body paragraphs with clear line breaks",
                "3) One practical takeaway or benefit point",
                "4) Soft CTA",
                "5) Natural hashtags matched to the post topic",
            ]
        )

    prompt_sections.extend(
        [
            "",
            "User instruction:",
            instruction,
            "",
            "URLs to consult with URL Context:",
            url_lines,
            "",
            "If an image block is useful, use an attached image source URL when available.",
        ]
    )

    return "\n".join(prompt_sections)


def _strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2:
            cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return cleaned.strip()


def _parse_json_response(text: str) -> dict[str, Any]:
    cleaned = _strip_json_fences(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("JSON parsing failed, attempting recovery with json-repair")
        return json.loads(repair_json(cleaned))


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
    source_type: str | None = None,
    enable_google_search: bool = False,
) -> dict[str, Any]:
    prompt = _build_generation_prompt(
        instruction=instruction,
        content_format=content_format,
        template_style=template_style,
        urls=urls,
        source_type=source_type,
        enable_google_search=enable_google_search,
    )

    tools: list[Any] = []
    if urls:
        tools.append({"url_context": {}})
    if enable_google_search:
        tools.append(types.Tool(google_search=types.GoogleSearch()))

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[prompt, *uploaded_files],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            tools=tools or None,
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
    blog_guidance = BLOG_TEMPLATE_GUIDANCE.get(template_style)
    guidance_section = ""
    if content_format == "blog" and blog_guidance:
        guidance_section = (
            "\nBlog option guidance:\n"
            f"{blog_guidance}\n"
            "\nImportant: keep returning structured bodyContent JSON only. "
            "Do not return raw HTML or raw Markdown.\n"
        )
    elif content_format == "instagram":
        guidance_section = (
            "\nInstagram option guidance:\n"
            f"{INSTAGRAM_TEMPLATE_GUIDANCE}\n"
            "\nImportant: keep returning structured bodyContent JSON and include platformOutput for instagram.\n"
        )

    prompt = f"""
Current article title: {article_title or ""}
Content format: {content_format}
Template style: {template_style}
{guidance_section}
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
