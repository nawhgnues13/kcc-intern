import json
import logging

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CollectedArticle, CuratedArticle

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """당신은 KCC그룹 사내 소식지 편집자입니다.
KCC 공식 블로그에 올라온 이번 주 게시글을 임직원에게 전달하는 것이 목표입니다.

KCC그룹은 KCC정보통신, KCC오토그룹(벤츠·포르쉐·JLR·혼다·스텔란티스·지커·아우디 딜러) 등을 운영하는 기업입니다.

선별 기준:
1. 이번 주에 게시된 최신 글 우선
2. 임직원 전체에게 공유할 가치가 있는 회사 공식 소식 (신규 사업, 이벤트, 수상, 캠페인, 인사 등)
3. 최대 4건 선별. 중요도 높은 순으로 4건, 게시글이 4건 미만이면 있는 것만 선별

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
    """KCC 블로그 게시글 선별 (최대 4건)"""
    slim = [
        {"title": a.title, "link": a.link, "description": a.description[:200], "published_date": a.published_date}
        for a in articles
    ]
    articles_json = json.dumps(slim, ensure_ascii=False, indent=2)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 KCC 블로그 게시글 중 이번 주 소식지에 실을 글을 선별해주세요:\n\n{articles_json}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json.loads(raw)
    curated = [CuratedArticle(**item) for item in parsed["articles"]]
    logger.info(f"KCC 블로그 선별 완료: {[a.title for a in curated]}")
    return curated
