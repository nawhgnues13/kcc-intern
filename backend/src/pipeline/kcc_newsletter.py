import logging

from src.pipeline.newsletter_graph import run_pipeline

logger = logging.getLogger(__name__)


async def run_kcc_newsletter_pipeline() -> str:
    """KCC 소식지: LangGraph 파이프라인 (수집 → 선별 → 작성 → 품질 검수 루프)"""
    return await run_pipeline("kcc")
