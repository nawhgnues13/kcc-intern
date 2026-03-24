import json
import logging

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CollectedArticle, CuratedArticle

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """당신은 IT 뉴스레터 편집자입니다.

다음 기준으로 뉴스레터 후보 기사 6건을 선별하세요.
반드시 아래 3개 카테고리에서 각 2건씩 선별해야 합니다:

[개발] 개발자 소식 / 도구
- 개발자가 실무에 바로 활용할 수 있는 기술, 도구, 트렌드
- 새로운 프레임워크, 라이브러리, DevOps, 아키텍처 패턴 등

[기술] 일반인 소프트웨어 / 기술 트렌드
- 비개발자도 알면 도움이 되는 앱, 서비스, 기술 변화
- 일상·업무에 직접적인 영향을 주는 실용적인 내용 우선

[심층분석] 신기술, 아키텍처, 보안 등에 대한 깊이 있는 분석
- 단순 뉴스가 아닌 배경·원리·영향까지 다루는 기사 우선

공통 선별 기준:
1. 독자에게 새로운 인사이트나 행동 변화를 줄 수 있는 기사 우선
2. 최신 트렌드를 반영 (AI, 클라우드, 보안, 개발도구, 산업동향 등)
3. 3건이 같은 주제나 소재가 되지 않도록 다양성 유지

반드시 아래 JSON 형식으로만 응답하세요:
{
  "articles": [
    {
      "title": "원문 제목",
      "link": "원문 URL",
      "description": "원문 요약",
      "published_date": "발행일",
      "source": "출처",
      "reason": "선정 이유 (한국어, 1~2문장)",
      "category": "개발 | 기술 | 심층분석 중 하나"
    }
  ]
}"""


def _strip_json_fences(text: str) -> str:
    """마크다운 코드블록 제거"""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # 첫 줄(```json 등)과 마지막 줄(```) 제거
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def curate(articles: list[CollectedArticle], max_input: int = 40) -> list[CuratedArticle]:
    """수집된 기사 중 뉴스레터 후보 6건 선별 (카테고리별 2건)"""
    # 토큰 절약: 최대 max_input건만 전달, 각 필드도 최소화
    limited = articles[:max_input]
    slim = [
        {"title": a.title, "link": a.link, "description": a.description[:200], "source": a.source, "published_date": a.published_date}
        for a in limited
    ]
    articles_json = json.dumps(slim, ensure_ascii=False, indent=2)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 기사 목록에서 뉴스레터 후보 기사 6건을 선별해주세요 (카테고리별 2건):\n\n{articles_json}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json.loads(raw)
    curated = [CuratedArticle(**item) for item in parsed["articles"]]
    logger.info(f"선별 완료: {[a.title for a in curated]}")
    return curated
