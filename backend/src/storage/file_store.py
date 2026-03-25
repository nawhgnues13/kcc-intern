import json
import uuid
from datetime import datetime
from pathlib import Path

from src.models.schemas import (
    CollectedArticle,
    CuratedArticle,
    ImageInfo,
    NewsletterContent,
    NewsletterStatus,
    StoredNewsletter,
)

DATA_DIR = Path("data")


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


def load_recipients(category: str | None = None) -> list[dict]:
    """DB에서 수신자 목록 조회. category: 'KCC_IT' | 'KCC_AUTOGROUP' | 'customers' | None(전체)"""
    from src.db import SessionLocal
    from src.services.crm_service import list_customers, list_employees

    db = SessionLocal()
    try:
        results: list[dict] = []
        if category in (None, "KCC_IT"):
            resp = list_employees(db=db, company_code="KCC_IT")
            for e in resp.items:
                if e.email:
                    results.append({"name": e.name, "email": e.email, "category": "KCC_IT"})
        if category in (None, "KCC_AUTOGROUP"):
            resp = list_employees(db=db, company_code="KCC_AUTOGROUP")
            for e in resp.items:
                if e.email:
                    results.append({"name": e.name, "email": e.email, "category": "KCC_AUTOGROUP"})
        if category in (None, "customers"):
            resp = list_customers(db=db)
            for c in resp.items:
                results.append({"name": c.name, "email": c.email, "category": "customers"})
        return results
    finally:
        db.close()


def get_db_recipient_options() -> list[dict]:
    """Slack 모달용 수신자 카테고리 옵션 목록 (value, label, count)"""
    from src.db import SessionLocal
    from src.services.crm_service import list_customers, list_employees

    db = SessionLocal()
    try:
        options = []
        for code, label in [("KCC_IT", "KCC정보통신 직원"), ("KCC_AUTOGROUP", "KCC오토그룹 직원")]:
            resp = list_employees(db=db, company_code=code)
            emails = [e for e in resp.items if e.email]
            options.append({"value": code, "label": label, "count": len(emails)})
        resp = list_customers(db=db)
        options.append({"value": "customers", "label": "전체 고객", "count": len(resp.items)})
        return options
    finally:
        db.close()


def save_curated(curated_id: str, articles: list[CuratedArticle], newsletter_type: str) -> None:
    """큐레이션 결과 저장 (Phase 1 완료 후 모달 선택 대기용)"""
    data = {
        "id": curated_id,
        "newsletter_type": newsletter_type,
        "articles": [a.model_dump() for a in articles],
        "created_at": datetime.now().isoformat(),
    }
    path = DATA_DIR / "curated" / f"{curated_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_curated(curated_id: str) -> dict:
    """큐레이션 결과 로드"""
    path = DATA_DIR / "curated" / f"{curated_id}.json"
    return json.loads(path.read_text(encoding="utf-8"))


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
