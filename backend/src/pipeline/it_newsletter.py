import logging
from datetime import datetime

from src.agents import it_curator, it_editor, it_scout
from src.services import email_service, image_service, template_service
from src.storage import file_store
from src.storage.file_store import NewsletterStatus

logger = logging.getLogger(__name__)


async def _send_it_newsletter_by_id(newsletter_id: str, recipients: list[dict] | None = None) -> bool:
    """저장된 IT 뉴스레터를 이메일로 발송 (Slack 승인 콜백용)"""
    try:
        stored = file_store.load_newsletter(newsletter_id)
        success = await email_service.send_email(
            html=stored.html,
            images=stored.images,
            subject=f"[IT 트렌드 위클리] {stored.content.generated_at[:10]}",
            recipients=recipients,
        )
        if success:
            file_store.update_status(newsletter_id, NewsletterStatus.SENT)
        return success
    except Exception as e:
        logger.error(f"IT 뉴스레터 발송 실패 ({newsletter_id}): {e}")
        return False


async def run_it_newsletter_pipeline() -> str:
    """IT 뉴스레터 생성 파이프라인 (KCC정보통신 대상)"""
    logger.info("=== IT 뉴스레터 파이프라인 시작 ===")

    # Step 1: IT 뉴스 수집
    articles = await it_scout.collect()
    logger.info(f"Step 1 완료 - 수집: {len(articles)}건")
    if not articles:
        logger.error("수집된 기사가 없습니다.")
        return ""

    # Step 2: 3건 선별
    curated = await it_curator.curate(articles)
    logger.info(f"Step 2 완료 - 선별: {len(curated)}건")

    # Step 3: 뉴스레터 본문 작성
    content = await it_editor.write(curated)
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
    html = template_service.render(content, images, newsletter_type="it")
    logger.info("Step 6 완료 - HTML 생성")

    # Step 7: 파일 저장
    file_store.save_newsletter(newsletter_id, content, html, images, newsletter_type="it")
    logger.info(f"Step 7 완료 - 저장: {newsletter_id}")

    # Step 8: Slack 전송 (승인 대기)
    from src.config import settings
    if settings.slack_bot_token and settings.slack_channel_id:
        from src.services import slack_service
        slack_service.set_send_email_callback(_send_it_newsletter_by_id)
        await slack_service.send_for_review(content, html, newsletter_id, newsletter_type="it")
        logger.info(f"=== IT 뉴스레터 Slack 검토 대기 중: {newsletter_id} ===")
    else:
        logger.info("Slack 미설정 - 바로 이메일 발송")
        today = datetime.now().strftime("%Y년 %m월 %d일")
        success = await email_service.send_email(html, images, f"[IT 트렌드 위클리] {today}")
        if success:
            file_store.update_status(newsletter_id, NewsletterStatus.SENT)
            logger.info(f"=== IT 파이프라인 완료: {newsletter_id} ===")
        else:
            logger.error("이메일 발송 실패")

    return newsletter_id


async def run_keyword_pipeline(keyword: str) -> str:
    """키워드 기반 뉴스레터 생성 파이프라인 (Slack 멘션 트리거) — 키워드 분류 후 적합한 파이프라인으로 라우팅"""
    logger.info(f"=== 키워드 파이프라인 시작: {keyword} ===")

    # Step 0: 키워드 분류 (it / auto / kcc)
    from src.agents.keyword_scout import classify_keyword, collect_by_keyword
    newsletter_type = await classify_keyword(keyword)
    logger.info(f"Step 0 완료 - 분류: {keyword} → {newsletter_type}")

    # Step 1: 키워드로 기사 수집 (Gemini Search Grounding)
    articles = await collect_by_keyword(keyword)
    logger.info(f"Step 1 완료 - 수집: {len(articles)}건")
    if not articles:
        logger.error("수집된 기사가 없습니다.")
        return ""

    # Step 2: 분류에 따라 큐레이터/에디터 선택
    if newsletter_type == "auto":
        from src.agents import auto_curator, auto_editor
        curated = await auto_curator.curate(articles)
        content = await auto_editor.write(curated)
    elif newsletter_type == "kcc":
        from src.agents import kcc_editor
        from src.models.schemas import CuratedArticle
        curated = [
            CuratedArticle(
                title=a.title, link=a.link, description=a.description,
                published_date=a.published_date, source=a.source,
                reason="키워드 검색 결과", category="회사소식",
            )
            for a in articles[:4]
        ]
        content = await kcc_editor.write(curated)
    else:  # it (기본값)
        curated = await it_curator.curate(articles)
        content = await it_editor.write(curated)
    logger.info(f"Step 2-3 완료 - 선별 {len(curated)}건, 본문 작성")

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
    html = template_service.render(content, images, newsletter_type=newsletter_type)
    logger.info("Step 6 완료 - HTML 생성")

    # Step 7: 파일 저장
    file_store.save_newsletter(newsletter_id, content, html, images, newsletter_type=newsletter_type)
    logger.info(f"Step 7 완료 - 저장: {newsletter_id}")

    # Step 8: Slack 전송 (승인 대기) — 타입에 맞는 발송 콜백 등록
    from src.services import slack_service
    if newsletter_type == "auto":
        from src.pipeline.auto_newsletter import _send_auto_newsletter_by_id
        slack_service.set_send_email_callback(_send_auto_newsletter_by_id)
    elif newsletter_type == "kcc":
        from src.pipeline.kcc_newsletter import _send_kcc_newsletter_by_id
        slack_service.set_send_email_callback(_send_kcc_newsletter_by_id)
    else:
        slack_service.set_send_email_callback(_send_it_newsletter_by_id)
    await slack_service.send_for_review(content, html, newsletter_id, newsletter_type=newsletter_type)
    logger.info(f"=== 키워드 파이프라인 완료, Slack 검토 대기 중: {newsletter_id} ===")

    return newsletter_id
