"""LangGraph 기반 뉴스레터 생성 파이프라인.

Phase 1: 품질 검수 루프 (write → review → retry)
Phase 2: 트렌드 기반 적응형 선별 (IT 전용)
"""
import logging
from pathlib import Path
from typing import TypedDict

from langgraph.graph import END, StateGraph

from src.models.schemas import (
    CollectedArticle,
    CuratedArticle,
    ImageInfo,
    NewsletterContent,
)
from src.storage import file_store

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


class NewsletterState(TypedDict):
    newsletter_type: str          # "it" | "auto" | "kcc"
    newsletter_id: str
    collected: list[CollectedArticle]
    trend: dict
    curated: list[CuratedArticle]
    content: NewsletterContent | None
    feedback: str | None
    quality_ok: bool
    retry_count: int
    images: list[ImageInfo]
    html: str


# ──────────────────────────────────────────────
# Nodes
# ──────────────────────────────────────────────

async def collect_node(state: NewsletterState) -> dict:
    newsletter_type = state["newsletter_type"]

    if newsletter_type == "it":
        from src.agents import it_scout
        articles = await it_scout.collect()
    elif newsletter_type == "auto":
        from src.agents import auto_scout
        articles = await auto_scout.collect()
    else:  # kcc
        from src.agents import kcc_scout
        articles = await kcc_scout.collect()

    return {"collected": articles}


async def trend_analyze_node(state: NewsletterState) -> dict:
    """IT 전용: 트렌드 분석 및 카테고리 배분 결정"""
    from src.agents import trend_analyzer
    trend = await trend_analyzer.analyze(state["collected"])
    return {"trend": trend}


async def curate_node(state: NewsletterState) -> dict:
    newsletter_type = state["newsletter_type"]
    articles = state["collected"]

    if newsletter_type == "it":
        from src.agents import it_curator
        trend = state.get("trend") or {}
        if trend:
            curated = await it_curator.adaptive_curate(articles, trend)
        else:
            curated = await it_curator.curate(articles)

    elif newsletter_type == "auto":
        from src.agents import auto_curator
        curated = await auto_curator.curate(articles)

    else:  # kcc
        from src.agents import kcc_curator
        curated = await kcc_curator.curate(articles)

    newsletter_id = state["newsletter_id"]
    file_store.save_curated(newsletter_id, curated, newsletter_type)
    return {"curated": curated}


async def write_node(state: NewsletterState) -> dict:
    newsletter_type = state["newsletter_type"]
    curated = state["curated"]
    feedback = state.get("feedback")
    retry_count = state.get("retry_count", 0)

    if newsletter_type == "it":
        from src.agents.it_editor import write
    elif newsletter_type == "auto":
        from src.agents.auto_editor import write
    else:  # kcc
        from src.agents.kcc_editor import write

    content = await write(curated, feedback=feedback)
    return {"content": content, "feedback": None}


async def review_node(state: NewsletterState) -> dict:
    from src.agents import reviewer
    content = state["content"]
    newsletter_type = state["newsletter_type"]
    retry_count = state.get("retry_count", 0)

    quality_ok, feedback = await reviewer.review(content, newsletter_type=newsletter_type)
    new_retry = retry_count + (0 if quality_ok else 1)

    if not quality_ok and new_retry >= MAX_RETRIES:
        logger.warning(f"[review] 최대 재시도 초과 ({MAX_RETRIES}회). 현재 결과로 진행.")
        quality_ok = True  # 강제 통과

    logger.info(f"[review] quality_ok={quality_ok}, retry={new_retry}")
    return {"quality_ok": quality_ok, "feedback": feedback if not quality_ok else None, "retry_count": new_retry}


async def process_images_node(state: NewsletterState) -> dict:
    from src.services import image_service
    newsletter_type = state["newsletter_type"]
    newsletter_id = state["newsletter_id"]
    content = state["content"]

    images = []
    for i, article in enumerate(content.articles):
        save_path = f"data/images/{newsletter_id}_{i}.png"

        if newsletter_type == "kcc":
            img_url = await image_service.extract_content_image(article.original_link)
            if img_url:
                img = ImageInfo(type="og", url=img_url)
                article.image_url = img_url
            else:
                try:
                    image_bytes = await image_service.generate_image(article.image_prompt or "")
                    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
                    Path(save_path).write_bytes(image_bytes)
                    img = ImageInfo(type="generated", file_path=save_path)
                    img = await image_service.upload_image_to_s3(
                        img, f"newsletter-assets/pipeline/{newsletter_id}_{i}.png"
                    )
                    article.image_url = img.url if (img.type == "og" and img.url) else f"cid:article_{i}"
                except Exception:
                    img = ImageInfo(type="none")
        else:
            img = await image_service.get_article_image(
                article_url=article.original_link,
                image_prompt=article.image_prompt or "",
                save_path=save_path,
            )
            img = await image_service.upload_image_to_s3(
                img, f"newsletter-assets/pipeline/{newsletter_id}_{i}.png"
            )
            if img.type == "og" and img.url:
                article.image_url = img.url
            elif img.type == "generated" and img.file_path:
                article.image_url = f"cid:article_{i}"

        images.append(img)

    logger.info(f"[{newsletter_type}] process_images 완료: {len(images)}건")
    return {"images": images, "content": content}


async def save_and_notify_node(state: NewsletterState) -> dict:
    from src.services import slack_service, template_service
    newsletter_type = state["newsletter_type"]
    newsletter_id = state["newsletter_id"]
    content = state["content"]
    curated = state["curated"]
    images = state["images"]

    html = template_service.render(content, images, newsletter_type=newsletter_type)
    file_store.save_newsletter(newsletter_id, content, html, images, newsletter_type=newsletter_type)
    logger.info(f"[{newsletter_type}] save 완료")

    await slack_service.send_for_review(curated, newsletter_id, newsletter_type=newsletter_type)
    logger.info(f"[{newsletter_type}] Slack 검토 대기 중: {newsletter_id}")

    return {"html": html}


# ──────────────────────────────────────────────
# Routing
# ──────────────────────────────────────────────

def route_after_collect(state: NewsletterState) -> str:
    if state["newsletter_type"] == "it":
        return "trend_analyze"
    return "curate"


def route_after_review(state: NewsletterState) -> str:
    if state["quality_ok"]:
        return "process_images"
    return "write"


# ──────────────────────────────────────────────
# Graph 빌드
# ──────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(NewsletterState)

    graph.add_node("collect", collect_node)
    graph.add_node("trend_analyze", trend_analyze_node)
    graph.add_node("curate", curate_node)
    graph.add_node("write", write_node)
    graph.add_node("review", review_node)
    graph.add_node("process_images", process_images_node)
    graph.add_node("save_and_notify", save_and_notify_node)

    graph.set_entry_point("collect")
    graph.add_conditional_edges("collect", route_after_collect, {
        "trend_analyze": "trend_analyze",
        "curate": "curate",
    })
    graph.add_edge("trend_analyze", "curate")
    graph.add_edge("curate", "write")
    graph.add_edge("write", "review")
    graph.add_conditional_edges("review", route_after_review, {
        "process_images": "process_images",
        "write": "write",
    })
    graph.add_edge("process_images", "save_and_notify")
    graph.add_edge("save_and_notify", END)

    return graph.compile()


newsletter_graph = build_graph()


# ──────────────────────────────────────────────
# 파이프라인 진입 함수
# ──────────────────────────────────────────────

def _initial_state(newsletter_type: str) -> NewsletterState:
    return NewsletterState(
        newsletter_type=newsletter_type,
        newsletter_id=file_store.generate_id(),
        collected=[],
        trend={},
        curated=[],
        content=None,
        feedback=None,
        quality_ok=False,
        retry_count=0,
        images=[],
        html="",
    )


async def run_pipeline(newsletter_type: str) -> str:
    """newsletter_type: 'it' | 'auto' | 'kcc'"""
    logger.info(f"=== [{newsletter_type.upper()}] LangGraph 파이프라인 시작 ===")
    initial = _initial_state(newsletter_type)
    result = await newsletter_graph.ainvoke(initial)
    newsletter_id = result["newsletter_id"]
    logger.info(f"=== [{newsletter_type.upper()}] 파이프라인 완료: {newsletter_id} ===")
    return newsletter_id
