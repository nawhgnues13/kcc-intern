import json
import json_repair
import logging

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CollectedArticle, CuratedArticle

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

# adaptive_curate에서 이 줄을 트렌드 분석 결과로 교체함
_DISTRIBUTION_LINE = "기본 배분: 트렌드 2건, 실무 2건, 인사이트 1건 (총 5건) — 트렌드에 따라 트렌드·실무는 각 1~3건으로 조정 가능, 인사이트는 1건 고정"

SYSTEM_INSTRUCTION = f"""당신은 IT 뉴스레터 편집자입니다.
개발자부터 비개발자 직장인까지 다양한 독자가 읽는 사내 IT 뉴스레터를 위한 기사를 선별합니다.

{_DISTRIBUTION_LINE}

[트렌드] 비개발자도 알면 도움이 될 소식
- 비개발자도 알면 업무·일상에 도움이 되는 앱, 서비스, 기술 변화
- 실용적이고 파급력 있는 내용 우선

[실무] 개발자·실무자에게 유용한 소식
- 개발자가 실무에 바로 활용할 수 있는 도구, 기술, 트렌드
- 새로운 프레임워크, 라이브러리, DevOps, 아키텍처 패턴 등

[인사이트] 깊이 있는 분석 — 반드시 1건만 선별
- 단순 뉴스가 아닌 배경·원리·영향까지 다루는 기사 우선
- 이번 주 가장 깊이 있게 다룰 가치가 있는 주제 1건만 선별

공통 선별 기준:
1. 독자에게 새로운 인사이트나 행동 변화를 줄 수 있는 기사 우선
2. 최신 트렌드 반영 (AI, 클라우드, 보안, 개발도구, 산업동향 등)
3. 기사 간 주제 중복 없이 다양성 유지

반드시 아래 JSON 형식으로만 응답하세요:
{{
  "articles": [
    {{
      "title": "원문 제목",
      "link": "원문 URL",
      "description": "원문 요약",
      "published_date": "발행일",
      "source": "출처",
      "reason": "선정 이유 (한국어, 1~2문장)",
      "category": "트렌드 | 실무 | 인사이트 중 하나"
    }}
  ]
}}"""


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def adaptive_curate(articles: list[CollectedArticle], trend: dict) -> list[CuratedArticle]:
    """트렌드 분석 결과를 반영한 적응형 선별.
    trend: {distribution: {카테고리: 건수}, total: int, trending_topics: [...], reasoning: str}
    """
    distribution: dict[str, int] = trend.get("distribution", {"트렌드": 2, "실무": 2, "인사이트": 1})
    total: int = trend.get("total", 5)
    trending_topics: list[str] = trend.get("trending_topics", [])
    reasoning: str = trend.get("reasoning", "")

    dist_desc = ", ".join(f"{cat} {cnt}건" for cat, cnt in distribution.items())
    trend_desc = f"\n주목 주제: {', '.join(trending_topics)}" if trending_topics else ""
    reasoning_desc = f"\n배분 근거: {reasoning}" if reasoning else ""

    distribution_line = (
        f"이번 주 트렌드 분석 결과에 따라 총 {total}건을 선별하세요 ({dist_desc})"
        f"{trend_desc}{reasoning_desc}\n"
        "카테고리에 적합한 기사가 부족하면 인접 카테고리에서 조정 가능 (단, 인사이트는 1건 고정)"
    )
    system = SYSTEM_INSTRUCTION.replace(_DISTRIBUTION_LINE, distribution_line)

    limited = articles[:40]
    slim = [
        {"title": a.title, "link": a.link, "description": a.description[:200], "source": a.source, "published_date": a.published_date}
        for a in limited
    ]

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=(
            f"다음 기사 목록에서 뉴스레터 기사 {total}건을 선별해주세요 "
            f"({dist_desc}):\n\n{json.dumps(slim, ensure_ascii=False, indent=2)}"
        ),
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json_repair.loads(raw)
    curated = [CuratedArticle(**item) for item in parsed["articles"]]
    logger.info(f"적응형 선별 완료 ({total}건): {[a.title[:30] for a in curated]}")
    return curated


async def curate(articles: list[CollectedArticle], max_input: int = 40) -> list[CuratedArticle]:
    """수집된 기사 중 뉴스레터 후보 5건 선별 (트렌드 2, 실무 2, 인사이트 1)"""
    limited = articles[:max_input]
    slim = [
        {"title": a.title, "link": a.link, "description": a.description[:200], "source": a.source, "published_date": a.published_date}
        for a in limited
    ]
    articles_json = json.dumps(slim, ensure_ascii=False, indent=2)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 기사 목록에서 뉴스레터 기사 5건을 선별해주세요 (트렌드 2건, 실무 2건, 인사이트 1건):\n\n{articles_json}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json_repair.loads(raw)
    curated = [CuratedArticle(**item) for item in parsed["articles"]]
    logger.info(f"선별 완료 ({len(curated)}건): {[a.title[:30] for a in curated]}")
    return curated
