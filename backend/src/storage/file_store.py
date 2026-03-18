import json
import uuid
from datetime import datetime
from pathlib import Path

from src.models.schemas import (
    CollectedArticle,
    ImageInfo,
    NewsletterContent,
    NewsletterStatus,
    StoredNewsletter,
)

DATA_DIR = Path("data")


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


def load_recipients(category: str | None = None) -> list[dict]:
    """수신자 목록 로드. category 지정 시 해당 분류만, None이면 전체 반환"""
    path = DATA_DIR / "recipients.json"
    all_recipients = json.loads(path.read_text(encoding="utf-8"))
    if category and category != "전체":
        return [r for r in all_recipients if r["category"] == category]
    return all_recipients


def get_categories() -> list[str]:
    """수신자 분류 목록 반환 (중복 제거)"""
    path = DATA_DIR / "recipients.json"
    all_recipients = json.loads(path.read_text(encoding="utf-8"))
    seen = []
    for r in all_recipients:
        if r["category"] not in seen:
            seen.append(r["category"])
    return seen


def save_collected(articles: list[CollectedArticle]) -> None:
    today = datetime.now().strftime("%Y-%m-%d")
    path = DATA_DIR / "collected" / f"{today}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps([a.model_dump() for a in articles], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def save_newsletter(
    newsletter_id: str,
    content: NewsletterContent,
    html: str,
    images: list[ImageInfo],
    newsletter_type: str = "it",
) -> str:
    newsletter = StoredNewsletter(
        id=newsletter_id,
        newsletter_type=newsletter_type,
        content=content,
        html=html,
        images=images,
        status=NewsletterStatus.PENDING,
        created_at=datetime.now().isoformat(),
    )
    path = DATA_DIR / "newsletters" / f"{newsletter_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(newsletter.model_dump_json(indent=2), encoding="utf-8")
    return newsletter_id


def load_newsletter(newsletter_id: str) -> StoredNewsletter:
    path = DATA_DIR / "newsletters" / f"{newsletter_id}.json"
    return StoredNewsletter.model_validate_json(path.read_text(encoding="utf-8"))


def update_newsletter_content(newsletter_id: str, content: NewsletterContent, html: str) -> None:
    """뉴스레터 본문·HTML 업데이트 (재작성 후 저장용)"""
    newsletter = load_newsletter(newsletter_id)
    newsletter.content = content
    newsletter.html = html
    path = DATA_DIR / "newsletters" / f"{newsletter_id}.json"
    path.write_text(newsletter.model_dump_json(indent=2), encoding="utf-8")


def update_status(newsletter_id: str, status: NewsletterStatus) -> None:
    newsletter = load_newsletter(newsletter_id)
    newsletter.status = status
    if status == NewsletterStatus.APPROVED:
        newsletter.reviewed_at = datetime.now().isoformat()
    elif status == NewsletterStatus.SENT:
        newsletter.sent_at = datetime.now().isoformat()
    path = DATA_DIR / "newsletters" / f"{newsletter_id}.json"
    path.write_text(newsletter.model_dump_json(indent=2), encoding="utf-8")
