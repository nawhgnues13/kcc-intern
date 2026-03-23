import json
import logging

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CollectedArticle, CuratedArticle

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

# KCC오토그룹 취급 브랜드
KCC_AUTO_BRANDS = "메르세데스-벤츠, 포르쉐, 재규어, 랜드로버, 혼다, 스텔란티스(지프·푸조·시트로엥·피아트·알파로메오), 지커, 아우디"

SYSTEM_INSTRUCTION = f"""당신은 수입차 딜러사 KCC오토그룹의 사내 뉴스레터 편집자입니다.
영업·서비스 직원들이 현장에서 바로 활용할 수 있는 정보를 선별하는 것이 목표입니다.

KCC오토그룹 취급 브랜드: {KCC_AUTO_BRANDS}

다음 기준으로 뉴스레터 후보 기사 6건을 선별하세요.
반드시 아래 3개 카테고리에서 각 2건씩 선별해야 합니다:

[차량 소식] 취급 브랜드 신차·업데이트
- KCC오토그룹 취급 브랜드의 신차 출시, 페이스리프트, 사양 변경, 리콜·서비스 캠페인
- 영업 상담 및 서비스 업무에 직접 도움이 되는 정보 우선

[시장 트렌드] 수입차 시장·소비자 트렌드
- 국내 수입차 판매 동향, 점유율, 소비자 구매 패턴 변화
- 경쟁 브랜드 동향, 고객이 관심 갖는 이슈

[정책·전기차] 전기차·기술·정책
- 전기차·하이브리드 신기술 및 취급 브랜드의 EV 전략
- 수입차 관련 정부 정책, 보조금, 환경 규제, 관세 이슈

공통 선별 기준:
1. 영업·서비스 현장에서 실제로 활용 가능한 정보 우선
2. 고객 응대 시 대화 주제가 될 수 있는 시의성 있는 내용
3. 3건이 같은 브랜드나 주제가 되지 않도록 다양성 유지

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
      "category": "차량 소식 | 시장 트렌드 | 정책·전기차 중 하나"
    }}
  ]
}}"""


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def curate(articles: list[CollectedArticle], max_input: int = 40) -> list[CuratedArticle]:
    """수집된 자동차 기사 중 뉴스레터 후보 6건 선별 (카테고리별 2건)"""
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
    logger.info(f"자동차 뉴스 선별 완료: {[a.title for a in curated]}")
    return curated
