import logging

from src.agents import it_curator
from src.pipeline.newsletter_graph import run_pipeline
from src.services import image_service, template_service
from src.storage import file_store

logger = logging.getLogger(__name__)


async def run_it_newsletter_pipeline() -> str:
    """IT 뉴스레터: LangGraph 파이프라인 (트렌드 분석 → 적응형 선별 → 작성 → 품질 검수 루프)"""
    return await run_pipeline("it")


async def run_keyword_pipeline(keyword: str) -> str:
    """키워드 기반 뉴스레터: 수집 → 선별 → 작성 → 이미지 → HTML → Slack 미리보기 대기"""
    logger.info(f"=== 키워드 파이프라인 시작: {keyword} ===")

    from src.agents.keyword_scout import classify_keyword, collect_by_keyword
    newsletter_type = await classify_keyword(keyword)
    logger.info(f"Step 0 완료 - 분류: {keyword} → {newsletter_type}")

    articles = await collect_by_keyword(keyword)
    logger.info(f"Step 1 완료 - 수집: {len(articles)}건")
    if not articles:
        logger.error("수집된 기사가 없습니다.")
        return ""

    if newsletter_type == "auto":
        from src.agents import auto_curator
        curated = await auto_curator.curate(articles)
    elif newsletter_type == "kcc":
        from src.models.schemas import CuratedArticle
        curated = [
            CuratedArticle(
                title=a.title, link=a.link, description=a.description,
                published_date=a.published_date, source=a.source,
                reason="키워드 검색 결과", category="회사소식",
            )
            for a in articles[:6]
        ]
    else:
        curated = await it_curator.curate(articles)
    logger.info(f"Step 2 완료 - 선별: {len(curated)}건")

    newsletter_id = file_store.generate_id()
    file_store.save_curated(newsletter_id, curated, newsletter_type)

    if newsletter_type == "auto":
        from src.agents.auto_editor import write
    elif newsletter_type == "kcc":
        from src.agents.kcc_editor import write
    else:
        from src.agents.it_editor import write
    content = await write(curated)

    images = []
    for i, article in enumerate(content.articles):
        img = await image_service.get_article_image(
            article_url=article.original_link,
            image_prompt=article.image_prompt or "",
            save_path=f"data/images/{newsletter_id}_{i}.png",
        )
        img = await image_service.upload_image_to_s3(img, f"newsletter-assets/pipeline/{newsletter_id}_{i}.png")
        if img.type == "og" and img.url:
            article.image_url = img.url
        elif img.type == "generated" and img.file_path:
            article.image_url = f"cid:article_{i}"
        images.append(img)

    html = template_service.render(content, images, newsletter_type=newsletter_type)
    file_store.save_newsletter(newsletter_id, content, html, images, newsletter_type=newsletter_type)

    from src.services import slack_service
    await slack_service.send_for_review(curated, newsletter_id, newsletter_type=newsletter_type)
    logger.info(f"=== 키워드 파이프라인 Slack 검토 대기 중: {newsletter_id} ===")

    return newsletter_id
