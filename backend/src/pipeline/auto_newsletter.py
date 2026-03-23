import logging

from src.agents import auto_curator, auto_scout
from src.services import image_service, template_service
from src.storage import file_store

logger = logging.getLogger(__name__)


async def run_auto_newsletter_pipeline() -> str:
    """자동차 뉴스레터: 수집 → 선별 → 작성 → 이미지 → HTML → Slack 미리보기 대기"""
    logger.info("=== 자동차 뉴스레터 파이프라인 시작 ===")

    articles = await auto_scout.collect()
    logger.info(f"Step 1 완료 - 수집: {len(articles)}건")
    if not articles:
        logger.error("수집된 기사가 없습니다.")
        return ""

    curated = await auto_curator.curate(articles)
    logger.info(f"Step 2 완료 - 선별: {len(curated)}건")

    newsletter_id = file_store.generate_id()
    file_store.save_curated(newsletter_id, curated, "auto")

    from src.agents.auto_editor import write
    content = await write(curated)
    logger.info("Step 3 완료 - 본문 작성")

    images = []
    for i, article in enumerate(content.articles):
        img = await image_service.get_article_image(
            article_url=article.original_link,
            image_prompt=article.image_prompt or "",
            save_path=f"data/images/{newsletter_id}_{i}.png",
        )
        if img.type == "og" and img.url:
            article.image_url = img.url
        elif img.type == "generated" and img.file_path:
            article.image_url = f"cid:article_{i}"
        images.append(img)
    logger.info("Step 4 완료 - 이미지 처리")

    html = template_service.render(content, images, newsletter_type="auto")
    file_store.save_newsletter(newsletter_id, content, html, images, newsletter_type="auto")
    logger.info("Step 5 완료 - HTML 저장")

    from src.services import slack_service
    await slack_service.send_for_review(curated, newsletter_id, newsletter_type="auto")
    logger.info(f"=== 자동차 뉴스레터 Slack 검토 대기 중: {newsletter_id} ===")

    return newsletter_id
