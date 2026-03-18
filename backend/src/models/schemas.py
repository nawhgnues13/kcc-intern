from pydantic import BaseModel
from enum import Enum
from typing import Optional
from datetime import datetime


class CollectedArticle(BaseModel):
    title: str
    link: str
    description: str
    published_date: str
    source: str  # "TechCrunch", "GeekNews" 등


class CuratedArticle(CollectedArticle):
    reason: str       # 선정 이유
    category: str     # "AI", "클라우드", "보안", "개발도구", "산업동향" 등


class NewsletterArticle(BaseModel):
    headline: str
    body: str
    summary: str
    original_link: str
    category: str
    image_url: Optional[str] = None
    image_prompt: Optional[str] = None  # Gemini 이미지 생성용


class NewsletterContent(BaseModel):
    intro: str
    articles: list[NewsletterArticle]
    generated_at: str


class ImageInfo(BaseModel):
    type: str  # "og" | "generated" | "none"
    url: Optional[str] = None
    file_path: Optional[str] = None


class NewsletterStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SENT = "sent"


class StoredNewsletter(BaseModel):
    id: str
    newsletter_type: str = "it"  # "it" | "auto"
    content: NewsletterContent
    html: str
    images: list[ImageInfo]
    status: NewsletterStatus
    created_at: str
    reviewed_at: Optional[str] = None
    sent_at: Optional[str] = None
