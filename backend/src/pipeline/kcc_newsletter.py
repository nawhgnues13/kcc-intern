import logging
from pathlib import Path

from src.agents import kcc_curator, kcc_scout
from src.models.schemas import CuratedArticle, ImageInfo
from src.services import image_service, template_service
from src.storage import file_store

logger = logging.getLogger(__name__)

MAX_ARTICLES = 6


async def run_kcc_newsletter_pipeline() -> str:
    """KCC 소식지: 수집 → 선별 → 작성 → 이미지 → HTML → Slack 미리보기 대기"""
    logger.info("=== KCC 소식지 파이프라인 시작 ===")

    articles = await kcc_scout.collect()
    logger.info(f"Step 1 완료 - 수집: {len(articles)}건")
    if not articles:
        logger.warning("지난달 KCC 블로그 게시글이 없습니다. 파이프라인 종료.")
        return ""

    if len(articles) <= MAX_ARTICLES:
        curated = [
            CuratedArticle(
                title=a.title,
                link=a.link,
                description=a.description,
                published_date=a.published_date,
                source=a.source,
                reason="KCC 공식 블로그 게시글",
                category="회사소식",
            )
            for a in articles
        ]
        logger.info(f"Step 2 완료 - 전체 {len(curated)}건 처리")
    else:
        curated = await kcc_curator.curate(articles)
        logger.info(f"Step 2 완료 - 선별 {len(curated)}건 처리")

    newsletter_id = file_store.generate_id()
    file_store.save_curated(newsletter_id, curated, "kcc")

    from src.agents.kcc_editor import write
    content = await write(curated)
    logger.info("Step 3 완료 - 본문 작성")

    images = []
    for i, article in enumerate(content.articles):
        img_url = await image_service.extract_content_image(article.original_link)
        if img_url:
            img = ImageInfo(type="og", url=img_url)
            article.image_url = img_url
        else:
            try:
                image_bytes = await image_service.generate_image(article.image_prompt or "")
                save_path = f"data/images/{newsletter_id}_{i}.png"
                Path(save_path).parent.mkdir(parents=True, exist_ok=True)
                Path(save_path).write_bytes(image_bytes)
                img = ImageInfo(type="generated", file_path=save_path)
                article.image_url = f"cid:article_{i}"
            except Exception:
                img = ImageInfo(type="none")
        images.append(img)
    logger.info("Step 4 완료 - 이미지 처리")

    html = template_service.render(content, images, newsletter_type="kcc")
    file_store.save_newsletter(newsletter_id, content, html, images, newsletter_type="kcc")
    logger.info("Step 5 완료 - HTML 저장")

    from src.services import slack_service
    await slack_service.send_for_review(curated, newsletter_id, newsletter_type="kcc")
    logger.info(f"=== KCC 소식지 Slack 검토 대기 중: {newsletter_id} ===")

    return newsletter_id
