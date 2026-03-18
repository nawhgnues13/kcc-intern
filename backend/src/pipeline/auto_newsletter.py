import logging
from datetime import datetime

from src.agents import auto_curator, auto_editor, auto_scout
from src.services import email_service, image_service, template_service
from src.storage import file_store
from src.storage.file_store import NewsletterStatus

logger = logging.getLogger(__name__)


async def _send_auto_newsletter_by_id(newsletter_id: str, recipients: list[dict] | None = None) -> bool:
    """저장된 자동차 뉴스레터를 이메일로 발송 (Slack 승인 콜백용)"""
    try:
        stored = file_store.load_newsletter(newsletter_id)
        success = await email_service.send_email(
            html=stored.html,
            images=stored.images,
            subject=f"[KCC오토 위클리] {stored.content.generated_at[:10]}",
            recipients=recipients,
        )
        if success:
            file_store.update_status(newsletter_id, NewsletterStatus.SENT)
        return success
    except Exception as e:
        logger.error(f"자동차 뉴스레터 발송 실패 ({newsletter_id}): {e}")
        return False


async def run_auto_newsletter_pipeline() -> str:
    """자동차 뉴스레터 파이프라인 (KCC오토 대상)"""
    logger.info("=== 자동차 뉴스레터 파이프라인 시작 ===")

    # Step 1: 자동차 뉴스 수집
    articles = await auto_scout.collect()
    logger.info(f"Step 1 완료 - 수집: {len(articles)}건")
    if not articles:
        logger.error("수집된 기사가 없습니다.")
        return ""

    # Step 2: 3건 선별
    curated = await auto_curator.curate(articles)
    logger.info(f"Step 2 완료 - 선별: {len(curated)}건")

    # Step 3: 뉴스레터 본문 작성
    content = await auto_editor.write(curated)
    logger.info("Step 3 완료 - 본문 작성")

    # Step 4: ID 생성
    newsletter_id = file_store.generate_id()

    # Step 5: 이미지 확보
    images = []
    for i, article in enumerate(content.articles):
        img = await image_service.get_article_image(
            article_url=article.original_link,
            image_prompt=article.image_prompt or "",
            save_path=f"data/images/{newsletter_id}_{i}.png",
        )
        images.append(img)
        if img.type == "og" and img.url:
            article.image_url = img.url
        elif img.type == "generated" and img.file_path:
            article.image_url = f"cid:article_{i}"
    logger.info("Step 5 완료 - 이미지 처리")

    # Step 6: HTML 생성
    html = template_service.render(content, images, newsletter_type="auto")
    logger.info("Step 6 완료 - HTML 생성")

    # Step 7: 파일 저장
    file_store.save_newsletter(newsletter_id, content, html, images, newsletter_type="auto")
    logger.info(f"Step 7 완료 - 저장: {newsletter_id}")

    # Step 8: Slack 전송 (승인 대기)
    from src.services import slack_service
    slack_service.set_send_email_callback(_send_auto_newsletter_by_id)
    await slack_service.send_for_review(content, html, newsletter_id, newsletter_type="auto")
    logger.info(f"=== 자동차 뉴스레터 파이프라인 완료, Slack 검토 대기 중: {newsletter_id} ===")

    return newsletter_id
