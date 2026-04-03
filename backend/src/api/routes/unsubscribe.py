import hashlib
import hmac

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from src.config import settings
from src.db import get_db
from src.models.email_unsubscribe import EmailUnsubscribe

router = APIRouter(tags=["unsubscribe"])


def _make_token(email: str) -> str:
    return hmac.new(
        settings.unsubscribe_secret.encode(),
        email.lower().encode(),
        hashlib.sha256,
    ).hexdigest()


def make_unsubscribe_url(email: str) -> str:
    token = _make_token(email)
    return f"{settings.server_url}/api/unsubscribe?email={email}&token={token}"


@router.get("/api/unsubscribe", response_class=HTMLResponse)
def unsubscribe(email: str, token: str, db: Session = Depends(get_db)):
    if not hmac.compare_digest(_make_token(email), token):
        return HTMLResponse(content=_page("잘못된 요청", "유효하지 않은 수신거부 링크입니다."), status_code=400)

    normalized = email.lower()
    exists = db.query(EmailUnsubscribe).filter(EmailUnsubscribe.email == normalized).first()
    if not exists:
        db.add(EmailUnsubscribe(email=normalized))
        db.commit()

    return HTMLResponse(content=_page("수신거부 완료", f"{email} 주소로의 뉴스레터 발송이 중단되었습니다."))


def _page(title: str, message: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<style>
  body {{ margin: 0; font-family: -apple-system, sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; }}
  .card {{ background: #fff; border-radius: 12px; padding: 48px; text-align: center; border: 1px solid #e2e8f0; max-width: 400px; }}
  h1 {{ font-size: 20px; color: #1e293b; margin: 0 0 12px; }}
  p {{ font-size: 14px; color: #64748b; margin: 0; }}
</style>
</head>
<body>
  <div class="card">
    <h1>{title}</h1>
    <p>{message}</p>
  </div>
</body>
</html>"""
