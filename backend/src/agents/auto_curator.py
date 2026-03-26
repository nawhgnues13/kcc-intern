import json
import json_repair
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
영업·서비스 직원들이 고객 응대와 현장 업무에 바로 활용할 수 있는 정보를 선별하는 것이 목표입니다.

KCC오토그룹 취급 브랜드: {KCC_AUTO_BRANDS}

기본 배분: 차량 2건, 시장 2건, 혜택 1건 (총 5건)
이번 주 기사 상황에 따라 아래 범위 내에서 조정하세요:
- 차량: 1~3건 (취급 브랜드 신차·리콜 소식이 많으면 늘림)
- 시장: 1~3건
- 혜택: 0~1건 (고객에게 전달할 만한 혜택·정책 소식이 없으면 0건도 가능)

[차량] 취급 브랜드 신차·업데이트·리콜
- KCC오토그룹 취급 브랜드의 신차 출시, 페이스리프트, 사양·가격 변경
- 리콜·서비스 캠페인 등 고객 안내가 필요한 정보
- 취급 브랜드 기사가 부족하면 수입차 전반의 차량 소식도 포함 가능

[시장] 수입차 시장 동향·소비자 트렌드
- 국내외 수입차 판매 동향, 점유율 변화, 가격 인상·인하 소식
- 소비자 구매 패턴 변화, 경쟁 브랜드 동향
- 영업 현장에서 고객 대화 소재가 될 수 있는 시의성 있는 내용

[혜택] 보조금·할인·정책
- 전기차·하이브리드 구매 보조금, 세제 혜택, 충전 인프라 정책
- 수입차 관련 정부 정책, 관세·환경 규제 변화
- 고객이 직접 받을 수 있는 할인·프로모션 정보
- 현장에서 고객 질문에 답할 수 있는 실질적 혜택 정보 우선

공통 선별 기준:
1. 영업·서비스 현장에서 고객 응대 시 실제로 활용 가능한 정보 우선
2. 같은 브랜드나 주제가 중복되지 않도록 다양성 유지
3. 이번 주 시의성이 높은 기사 우선

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
      "category": "차량 | 시장 | 혜택 중 하나"
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
    """수집된 자동차 기사 중 뉴스레터 후보 선별 (차량 1~3건, 시장 1~3건, 혜택 0~1건)"""
    limited = articles[:max_input]
    slim = [
        {"title": a.title, "link": a.link, "description": a.description[:200], "source": a.source, "published_date": a.published_date}
        for a in limited
    ]
    articles_json = json.dumps(slim, ensure_ascii=False, indent=2)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 기사 목록에서 뉴스레터 기사를 선별해주세요 (차량 1~3건, 시장 1~3건, 혜택 0~1건, 총 기본 5건):\n\n{articles_json}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json_repair.loads(raw)
    curated = [CuratedArticle(**item) for item in parsed["articles"]]
    logger.info(f"자동차 뉴스 선별 완료 ({len(curated)}건): {[a.title[:30] for a in curated]}")
    return curated
