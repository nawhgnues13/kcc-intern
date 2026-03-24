from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile as StarletteUploadFile

from src.db import get_db
from src.schemas.newsletter import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantEditResponse,
    ArticleAIMessageResponse,
    ArticleResponse,
    NewsletterDeleteResponse,
    NewsletterDetailResponse,
    NewsletterGenerateResponse,
    NewsletterImageUploadResponse,
    NewsletterListResponse,
    NewsletterMessagesResponse,
    NewsletterSaveRequest,
    NewsletterSaveResponse,
    NewsletterSendRequest,
    NewsletterSendResponse,
)
from src.services.newsletter_service import (
    assistant_chat,
    assistant_edit,
    delete_newsletter,
    generate_newsletter,
    get_newsletter_detail,
    get_newsletter_messages,
    list_newsletters,
    save_newsletter,
    send_newsletter,
    upload_newsletter_editor_image,
)

router = APIRouter(prefix="/api/newsletters", tags=["newsletters"])
ALLOWED_CONTENT_FORMATS = {"newsletter", "blog", "instagram"}
ALLOWED_BLOG_TEMPLATE_STYLES = {
    "blog_naver_basic",
    "blog_html",
    "blog_markdown",
}
ALLOWED_INSTAGRAM_TEMPLATE_STYLES = {"instagram_default"}


@router.post(
    "/generate",
    response_model=NewsletterGenerateResponse,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": [
                            "user_id",
                            "content_format",
                            "template_style",
                            "instruction",
                        ],
                        "properties": {
                            "user_id": {"type": "string", "format": "uuid"},
                            "content_task_id": {"type": "string", "format": "uuid"},
                            "content_format": {"type": "string"},
                            "template_style": {"type": "string"},
                            "instruction": {"type": "string"},
                            "urls": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "url_names": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "files": {
                                "type": "array",
                                "items": {"type": "string", "format": "binary"},
                            },
                        },
                    }
                }
            },
        }
    },
)
async def generate_newsletter_route(
    request: Request,
    db: Session = Depends(get_db),
):
    form = await request.form()

    try:
        user_id = UUID(str(form["user_id"]))
    except KeyError as exc:
        raise HTTPException(status_code=422, detail="user_id is required.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="user_id must be a valid UUID.") from exc

    content_task_id = None
    raw_content_task_id = form.get("content_task_id")
    if raw_content_task_id:
        try:
            content_task_id = UUID(str(raw_content_task_id))
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail="content_task_id must be a valid UUID.",
            ) from exc

    content_format = str(form.get("content_format", "")).strip()
    template_style = str(form.get("template_style", "")).strip()
    instruction = str(form.get("instruction", "")).strip()

    if not content_format:
        raise HTTPException(status_code=422, detail="content_format is required.")
    if not template_style:
        raise HTTPException(status_code=422, detail="template_style is required.")
    if not instruction:
        raise HTTPException(status_code=422, detail="instruction is required.")
    if content_format not in ALLOWED_CONTENT_FORMATS:
        raise HTTPException(
            status_code=422,
            detail="content_format must be one of: newsletter, blog, instagram.",
        )
    if content_format == "blog" and template_style not in ALLOWED_BLOG_TEMPLATE_STYLES:
        raise HTTPException(
            status_code=422,
            detail=(
                "For blog content, template_style must be one of: "
                "blog_naver_basic, blog_html, blog_markdown."
            ),
        )
    if (
        content_format == "instagram"
        and template_style not in ALLOWED_INSTAGRAM_TEMPLATE_STYLES
    ):
        raise HTTPException(
            status_code=422,
            detail="For instagram content, template_style must be: instagram_default.",
        )

    urls = [
        value.strip()
        for value in form.getlist("urls")
        if isinstance(value, str) and value.strip()
    ]
    invalid_urls = [value for value in urls if not value.startswith(("http://", "https://"))]
    if invalid_urls:
        raise HTTPException(
            status_code=422,
            detail="All urls values must be absolute URLs starting with http:// or https://.",
        )
    url_names = [
        str(value).strip()
        for value in form.getlist("url_names")
        if isinstance(value, str)
    ]
    files = [
        value
        for value in form.getlist("files")
        if isinstance(value, StarletteUploadFile) and getattr(value, "filename", "")
    ]

    return await generate_newsletter(
        db=db,
        user_id=user_id,
        content_task_id=content_task_id,
        content_format=content_format,
        template_style=template_style,
        instruction=instruction,
        urls=urls,
        url_names=url_names,
        files=files,
    )


@router.get("", response_model=NewsletterListResponse)
async def list_newsletters_route(
    author_user_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    return list_newsletters(db=db, author_user_id=author_user_id)


@router.get("/{article_id}", response_model=NewsletterDetailResponse)
async def get_newsletter_detail_route(article_id: UUID, db: Session = Depends(get_db)):
    return get_newsletter_detail(db=db, article_id=article_id)


@router.get("/{article_id}/messages", response_model=NewsletterMessagesResponse)
async def get_newsletter_messages_route(article_id: UUID, db: Session = Depends(get_db)):
    return get_newsletter_messages(db=db, article_id=article_id)


@router.post("/{article_id}/assistant/chat", response_model=AssistantChatResponse)
async def assistant_chat_route(
    article_id: UUID,
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
):
    user_message, assistant_message = assistant_chat(
        db=db,
        article_id=article_id,
        message=payload.message,
    )
    return AssistantChatResponse(
        article_id=article_id,
        user_message=ArticleAIMessageResponse.model_validate(user_message),
        assistant_message=ArticleAIMessageResponse.model_validate(assistant_message),
    )


@router.post("/{article_id}/assistant/edit", response_model=AssistantEditResponse)
async def assistant_edit_route(
    article_id: UUID,
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
):
    user_message, assistant_message, article = await assistant_edit(
        db=db,
        article_id=article_id,
        message=payload.message,
    )
    return AssistantEditResponse(
        article_id=article_id,
        user_message=ArticleAIMessageResponse.model_validate(user_message),
        assistant_message=ArticleAIMessageResponse.model_validate(assistant_message),
        article=ArticleResponse.model_validate(article),
    )


@router.post("/{article_id}/assets/images", response_model=NewsletterImageUploadResponse)
async def upload_newsletter_editor_image_route(
    article_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await upload_newsletter_editor_image(
        db=db,
        article_id=article_id,
        file=file,
    )


@router.put("/{article_id}", response_model=NewsletterSaveResponse)
async def save_newsletter_route(
    article_id: UUID,
    payload: NewsletterSaveRequest,
    db: Session = Depends(get_db),
):
    return save_newsletter(
        db=db,
        article_id=article_id,
        title=payload.title,
        body_content=payload.body_content,
        content_format=payload.content_format,
        template_style=payload.template_style,
    )


@router.delete("/{article_id}", response_model=NewsletterDeleteResponse)
async def delete_newsletter_route(article_id: UUID, db: Session = Depends(get_db)):
    return delete_newsletter(db=db, article_id=article_id)


@router.post("/{article_id}/send", response_model=NewsletterSendResponse)
async def send_newsletter_route(
    article_id: UUID,
    payload: NewsletterSendRequest,
    db: Session = Depends(get_db),
):
    return await send_newsletter(
        db=db,
        article_id=article_id,
        recipients=payload.recipients,
        subject=payload.subject,
        html=payload.html,
    )
