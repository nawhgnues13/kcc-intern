import json
import json_repair
import logging

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CollectedArticle

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

TREND_SYSTEM = """당신은 IT 뉴스 트렌드 분석가입니다.
수집된 기사를 분석해 이번 주 IT 트렌드를 파악하고, KCC정보통신 사내 뉴스레터의 카테고리별 최적 기사 수를 결정합니다.

카테고리 정의:
- 트렌드: 비개발자도 알면 업무·일상에 도움이 되는 앱·서비스·기술 트렌드
- 실무: 개발자·실무자에게 유용한 도구, 프레임워크, DevOps, 아키텍처 소식
- 인사이트: 배경·원리·산업 영향까지 다루는 깊이 있는 분석 기사

배분 결정 기준:
- 총 기사 수: 5~7건 사이로 결정
- 트렌드: 기본 2건, 1~3건 범위에서 조정
- 실무: 기본 2건, 1~3건 범위에서 조정
- 인사이트: 반드시 1건 고정 (2건 이상 절대 금지 — 깊이 있는 1건이 핵심)
- 이번 주 특정 이슈(주요 AI 출시, 대형 보안 사고, 핵심 오픈소스 릴리즈 등)가 집중된다면
  트렌드 또는 실무 비중을 높여 해당 주제를 충분히 다룰 것
- KCC 직원(개발자 ~ 비개발자 직장인) 모두에게 가치 있는 구성 최우선

반드시 아래 JSON 형식으로만 응답하세요:
{
  "distribution": {"트렌드": 2, "실무": 2, "인사이트": 1},
  "total": 5,
  "trending_topics": ["이번 주 주목할 핵심 주제 최대 3개"],
  "reasoning": "이 배분을 선택한 이유 (2~3문장, 구체적으로)"
}"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def analyze(articles: list[CollectedArticle]) -> dict:
    """수집된 기사 트렌드 분석 및 카테고리 배분 결정.
    반환: {distribution, total, trending_topics, reasoning}
    """
    slim = [
        {
            "title": a.title,
            "description": a.description[:150],
            "source": a.source,
            "published_date": a.published_date,
        }
        for a in articles[:60]
    ]

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=(
            f"다음 {len(slim)}건의 기사를 분석해 이번 주 IT 트렌드와 "
            f"뉴스레터 카테고리 배분을 결정해주세요:\n\n"
            f"{json.dumps(slim, ensure_ascii=False, indent=2)}"
        ),
        config=types.GenerateContentConfig(
            system_instruction=TREND_SYSTEM,
            response_mime_type="application/json",
        ),
    )

    result = json_repair.loads(_strip_fences(response.text))

    logger.info(
        f"트렌드 분석 완료 | "
        f"배분: {result.get('distribution')} (총 {result.get('total')}건) | "
        f"주목 주제: {result.get('trending_topics')}"
    )
    logger.info(f"배분 근거: {result.get('reasoning')}")

    return result
