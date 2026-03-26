import json
import json_repair
import logging

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CollectedArticle, CuratedArticle

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """당신은 KCC그룹 사내 소식지 편집자입니다.
KCC 공식 블로그에 올라온 게시글 중 임직원에게 전달할 소식을 선별하는 것이 목표입니다.

KCC그룹은 KCC정보통신, KCC오토그룹(벤츠·포르쉐·JLR·혼다·스텔란티스·지커·아우디 딜러) 등을 운영하는 기업입니다.

선별 우선순위 (아래 순서대로 채울 것):
1순위 — 공식 뉴스·사업 소식: 신규 사업 진출, 조직 변화, 수상·인증, 파트너십 등 회사 공식 발표
2순위 — 사회공헌: 경영진·회사 차원의 기부, 봉사, ESG 활동
3순위 — 회사 행사·이벤트: 임직원 또는 고객 대상 공식 행사, 캠페인
4순위 — 브랜드·홍보 콘텐츠: 위 3가지로 5건을 채우지 못할 경우에 한해 포함

최대 5건 선별. 게시글이 5건 미만이면 있는 것만 전부 선별.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "articles": [
    {
      "title": "원문 제목",
      "link": "원문 URL",
      "description": "원문 요약",
      "published_date": "발행일",
      "source": "KCC공식블로그",
      "reason": "선정 이유 (한국어, 1문장)",
      "category": "회사소식"
    }
  ]
}"""


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def curate(articles: list[CollectedArticle]) -> list[CuratedArticle]:
    """KCC 블로그 게시글 선별 (최대 5건)"""
    slim = [
        {"title": a.title, "link": a.link, "description": a.description[:200], "published_date": a.published_date}
        for a in articles
    ]
    articles_json = json.dumps(slim, ensure_ascii=False, indent=2)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 KCC 블로그 게시글 중 소식지에 실을 글을 최대 5건 선별해주세요:\n\n{articles_json}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json_repair.loads(raw)
    curated = [CuratedArticle(**item) for item in parsed["articles"]]
    logger.info(f"KCC 블로그 선별 완료: {[a.title for a in curated]}")
    return curated
