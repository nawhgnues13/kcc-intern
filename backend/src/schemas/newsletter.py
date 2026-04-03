from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ArticleSourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)

    id: UUID
    source_type: str
    original_name: Optional[str]
    source_url: Optional[str]
    storage_url: Optional[str]
    mime_type: Optional[str]
    extracted_text: Optional[str]
    sort_order: int
    created_at: datetime


class ArticleAIMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)

    id: UUID
    role: str
    message_text: str
    message_kind: Optional[str]
    created_at: datetime


class ArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)

    id: UUID
    content_format: str
    topic: Optional[str]
    template_style: str
    title: Optional[str]
    body_content: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class SocialPlatformOutputResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    platform: str
    post_text: str
    hashtags: list[str] = Field(default_factory=list)
    image_download_urls: list[str] = Field(default_factory=list)


class InstagramPlatformOutputResponse(SocialPlatformOutputResponse):
    pass


class InstagramPublishInfoResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    status: str
    attempted_at: datetime
    published_at: Optional[datetime] = None
    published_external_id: Optional[str] = None
    published_permalink: Optional[str] = None
    image_count: int
    host_url: Optional[str] = None
    ig_user_id: Optional[str] = None
    error: Optional[str] = None


class InstagramPublishRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    access_token: Optional[str] = None
    ig_user_id: Optional[str] = None
    api_version: Optional[str] = None
    host_url: Optional[str] = None
    force: bool = False


class InstagramPublishResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    task_id: UUID
    article_id: UUID
    publish_info: InstagramPublishInfoResponse


class NewsletterGenerateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    title: Optional[str]
    content_format: str
    topic: Optional[str]
    template_style: str
    author_user_id: Optional[UUID]
    author_name: Optional[str]
    body_content: dict[str, Any]
    sources: list[ArticleSourceResponse]
    messages: list[ArticleAIMessageResponse]
    warnings: list[str]
    platform_output: Optional[SocialPlatformOutputResponse] = None
    instagram_publish: Optional[InstagramPublishInfoResponse] = None


class NewsletterListItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    title: Optional[str]
    content_format: str
    topic: Optional[str]
    template_style: str
    author_user_id: Optional[UUID]
    author_name: Optional[str]
    thumbnail_image_url: Optional[str]
    summary: Optional[str]
    created_at: datetime
    updated_at: datetime


class NewsletterListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[NewsletterListItemResponse]


class AssistantChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    message: str = Field(min_length=1)


class AssistantChatResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    user_message: ArticleAIMessageResponse
    assistant_message: ArticleAIMessageResponse


class AssistantEditResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    user_message: ArticleAIMessageResponse
    assistant_message: ArticleAIMessageResponse
    article: ArticleResponse


class NewsletterDetailResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    content_format: str
    topic: Optional[str]
    template_style: str
    title: Optional[str]
    author_user_id: Optional[UUID]
    author_name: Optional[str]
    body_content: dict[str, Any]
    sources: list[ArticleSourceResponse]
    messages: list[ArticleAIMessageResponse]
    created_at: datetime
    updated_at: datetime
    platform_output: Optional[SocialPlatformOutputResponse] = None
    instagram_publish: Optional[InstagramPublishInfoResponse] = None


class NewsletterMessagesResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    messages: list[ArticleAIMessageResponse]


class NewsletterSaveRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    title: Optional[str] = Field(default=None, max_length=200)
    body_content: dict[str, Any]
    content_format: Optional[str] = None
    template_style: Optional[str] = None


class NewsletterSaveResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    title: Optional[str]
    body_content: dict[str, Any]
    updated_at: datetime


class NewsletterDeleteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    deleted_at: datetime
    message: str


class NewsletterImageUploadResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    image_url: str


class EmailRecipient(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    name: str = ""
    email: str


class NewsletterSendRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    recipients: list[EmailRecipient]
    subject: Optional[str] = None
    html: Optional[str] = None


class NewsletterResendRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    log_id: str
    email: str


class NewsletterSendResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    article_id: UUID
    sent_count: int
    total_count: int
    skipped_emails: list[str] = []
    failed_emails: list[str] = []
