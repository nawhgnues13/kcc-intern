import asyncio
import logging
from email.message import EmailMessage
from pathlib import Path

import aiosmtplib
import httpx

from src.config import settings
from src.models.schemas import ImageInfo

logger = logging.getLogger(__name__)


async def _fetch_image_bytes(url: str) -> bytes | None:
    """외부 URL 이미지 다운로드"""
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code == 200:
                return r.content
    except Exception as e:
        logger.warning(f"이미지 다운로드 실패 ({url[:60]}): {e}")
    return None


async def _build_message(html: str, images: list[ImageInfo], subject: str, to_email: str, to_name: str) -> EmailMessage:
    """수신자 1명용 EmailMessage 생성 (OG 이미지도 CID 인라인 첨부)"""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.gmail_user
    msg["To"] = f"{to_name} <{to_email}>"
    msg.set_content("뉴스레터를 보려면 HTML을 지원하는 이메일 클라이언트를 사용하세요.")

    # OG 이미지 URL을 CID로 치환
    final_html = html
    for i, img in enumerate(images):
        if img.type == "og" and img.url:
            final_html = final_html.replace(img.url, f"cid:article_{i}")

    msg.add_alternative(final_html, subtype="html")
    html_part = msg.get_payload()[1]

    for i, img in enumerate(images):
        if img.type == "generated" and img.file_path:
            try:
                image_data = Path(img.file_path).read_bytes()
                html_part.add_related(
                    image_data,
                    maintype="image",
                    subtype="png",
                    cid=f"<article_{i}>",
                )
            except Exception as e:
                logger.warning(f"생성 이미지 첨부 실패 (article_{i}): {e}")

        elif img.type == "og" and img.url:
            image_data = await _fetch_image_bytes(img.url)
            if image_data:
                # 이미지 포맷 추정 (URL 확장자 기준, 기본 jpeg)
                ext = img.url.rsplit(".", 1)[-1].lower().split("?")[0]
                subtype = ext if ext in ("png", "gif", "webp") else "jpeg"
                try:
                    html_part.add_related(
                        image_data,
                        maintype="image",
                        subtype=subtype,
                        cid=f"<article_{i}>",
                    )
                except Exception as e:
                    logger.warning(f"OG 이미지 첨부 실패 (article_{i}): {e}")

    return msg


async def _send_one(msg: EmailMessage) -> bool:
    """단일 메시지 발송 (Gmail SMTP)"""
    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.gmail_user,
            password=settings.gmail_app_password,
        )
        return True
    except Exception as e:
        logger.error(f"발송 실패 ({msg['To']}): {e}")
        return False


def _inject_unsubscribe_link(html: str, email: str) -> str:
    """HTML 하단에 수신거부 링크 삽입"""
    from src.api.routes.unsubscribe import make_unsubscribe_url
    url = make_unsubscribe_url(email)
    link = (
        f'<div style="text-align:center;padding:16px;font-size:12px;color:#94a3b8;">'
        f'<a href="{url}" style="color:#94a3b8;">수신거부</a>'
        f'</div>'
    )
    if "</body>" in html:
        return html.replace("</body>", f"{link}</body>")
    return html + link


async def _send_via_resend(
    html: str,
    subject: str,
    recipients: list[dict],
) -> dict[str, list[str]]:
    """Resend API를 사용한 이메일 발송. {"success": [...], "failed": [...]} 반환"""
    import resend

    resend.api_key = settings.resend_api_key
    from_address = settings.email_from or f"newsletter@{settings.resend_api_key}"

    async def _send_one_resend(r: dict) -> bool:
        to = f"{r['name']} <{r['email']}>" if r.get("name") else r["email"]
        personalized_html = _inject_unsubscribe_link(html, r["email"])
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: resend.Emails.send({
                    "from": from_address,
                    "to": [to],
                    "subject": subject,
                    "html": personalized_html,
                }),
            )
            return True
        except Exception as e:
            logger.error(f"Resend 발송 실패 ({r['email']}): {e}", exc_info=True)
            return False

    results = await asyncio.gather(*[_send_one_resend(r) for r in recipients])
    success = [r["email"] for r, ok in zip(recipients, results) if ok]
    failed = [r["email"] for r, ok in zip(recipients, results) if not ok]
    logger.info(f"Resend 이메일 발송 완료: {len(success)}/{len(recipients)}명")
    return {"success": success, "failed": failed}


async def send_email(
    html: str,
    images: list[ImageInfo],
    subject: str,
    recipients: list[dict] | None = None,
) -> dict[str, list[str]]:
    """
    HTML 뉴스레터 이메일 발송.
    recipients: [{"name": "...", "email": "..."}] 형태.
    None이면 .env의 EMAIL_TO로 단일 발송.
    RESEND_API_KEY가 설정되어 있으면 Resend, 없으면 Gmail SMTP 사용.
    {"success": [...], "failed": [...]} 반환.
    """
    if not recipients:
        recipients = [{"name": "", "email": settings.email_to}]

    if settings.resend_api_key:
        return await _send_via_resend(html, subject, recipients)

    tasks = [
        _build_message(_inject_unsubscribe_link(html, r["email"]), images, subject, r["email"], r["name"])
        for r in recipients
    ]
    messages = await asyncio.gather(*tasks)

    send_tasks = [_send_one(msg) for msg in messages]
    results = await asyncio.gather(*send_tasks)

    success = [r["email"] for r, ok in zip(recipients, results) if ok]
    failed = [r["email"] for r, ok in zip(recipients, results) if not ok]
    logger.info(f"이메일 발송 완료: {len(success)}/{len(recipients)}명")
    return {"success": success, "failed": failed}
