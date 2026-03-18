import logging
from pathlib import Path

from src.agents import kcc_curator, kcc_editor, kcc_scout
from src.models.schemas import CuratedArticle, ImageInfo
from src.services import email_service, image_service, template_service
from src.storage import file_store
from src.storage.file_store import NewsletterStatus

logger = logging.getLogger(__name__)

MAX_ARTICLES = 4


async def _send_kcc_newsletter_by_id(newsletter_id: str, recipients: list[dict] | None = None) -> bool:
    """저장된 KCC 소식지를 이메일로 발송 (Slack 승인 콜백용)"""
    try:
        stored = file_store.load_newsletter(newsletter_id)
        success = await email_service.send_email(
            html=stored.html,
            images=stored.images,
            subject=f"[KCC 이번 주 소식] {stored.content.generated_at[:10]}",
            recipients=recipients,
        )
        if success:
            file_store.update_status(newsletter_id, NewsletterStatus.SENT)
        return success
    except Exception as e:
        logger.error(f"KCC 소식지 발송 실패 ({newsletter_id}): {e}")
        return False


async def run_kcc_newsletter_pipeline() -> str:
    """KCC 회사 소식지 파이프라인 (전체 임직원 대상)"""
    logger.info("=== KCC 소식지 파이프라인 시작 ===")

    # Step 1: KCC 블로그 수집
    articles = await kcc_scout.collect()
    logger.info(f"Step 1 완료 - 수집: {len(articles)}건")
    if not articles:
        logger.warning("지난달 KCC 블로그 게시글이 없습니다. 파이프라인 종료.")
        return ""

    # Step 2: 4건 이하면 전체, 초과하면 큐레이터로 선별
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

    # Step 3: 소식지 본문 작성
    content = await kcc_editor.write(curated)
    logger.info("Step 3 완료 - 본문 작성")

    # Step 4: ID 생성
    newsletter_id = file_store.generate_id()

    # Step 5: 이미지 확보
    # KCC 블로그 OG는 로고 고정이므로 본문 첫 번째 이미지 우선,
    # 없으면 OG를 거치지 않고 바로 Gemini 생성
    images = []
    for i, article in enumerate(content.articles):
        img_url = await image_service.extract_content_image(article.original_link)
        if img_url:
            img = ImageInfo(type="og", url=img_url)
            article.image_url = img_url
            logger.info(f"본문 이미지 사용: {img_url[:60]}...")
        else:
            # 본문 이미지 없음 → Gemini 생성 (OG 로고 스킵)
            try:
                image_bytes = await image_service.generate_image(article.image_prompt or "")
                save_path = f"data/images/{newsletter_id}_{i}.png"
                save_file = Path(save_path)
                save_file.parent.mkdir(parents=True, exist_ok=True)
                save_file.write_bytes(image_bytes)
                img = ImageInfo(type="generated", file_path=save_path)
                article.image_url = f"cid:article_{i}"
                logger.info(f"Gemini 이미지 생성: {save_path}")
            except Exception as e:
                logger.warning(f"Gemini 이미지 생성 실패: {e}")
                img = ImageInfo(type="none")
        images.append(img)
    logger.info("Step 5 완료 - 이미지 처리")

    # Step 6: HTML 생성
    html = template_service.render(content, images, newsletter_type="kcc")
    logger.info("Step 6 완료 - HTML 생성")

    # Step 7: 파일 저장
    file_store.save_newsletter(newsletter_id, content, html, images, newsletter_type="kcc")
    logger.info(f"Step 7 완료 - 저장: {newsletter_id}")

    # Step 8: Slack 전송 (승인 대기)
    from src.services import slack_service
    slack_service.set_send_email_callback(_send_kcc_newsletter_by_id)
    await slack_service.send_for_review(content, html, newsletter_id, newsletter_type="kcc")
    logger.info(f"=== KCC 소식지 Slack 검토 대기 중: {newsletter_id} ===")

    return newsletter_id
