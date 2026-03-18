import json
import logging

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CollectedArticle

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """당신은 뉴스 수집 에이전트입니다.
주어진 키워드와 관련된 최신 기사를 웹에서 검색하여 5~10건을 수집하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "articles": [
    {
      "title": "기사 제목",
      "link": "기사 URL",
      "description": "기사 내용 요약 (200자 이내)",
      "published_date": "발행일 (알 수 없으면 빈 문자열)",
      "source": "출처 매체명"
    }
  ]
}

규칙:
- 반드시 실제 존재하는 URL만 사용 (지어내지 말 것)
- URL을 알 수 없으면 해당 기사 제외
- 최신 기사 우선 수집
- 같은 주제의 중복 기사 제외"""


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def classify_keyword(keyword: str) -> str:
    """키워드를 분석해 뉴스레터 타입 반환: 'it' | 'auto' | 'kcc'"""
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 키워드가 어떤 뉴스레터 카테고리에 가장 적합한지 판단해줘: '{keyword}'",
        config=types.GenerateContentConfig(
            system_instruction="""다음 키워드를 아래 3개 카테고리 중 하나로 분류하세요.
반드시 'it', 'auto', 'kcc' 중 하나만 응답하세요.

- it: IT/기술/소프트웨어/AI/개발/클라우드/보안 등 기술 전반
- auto: 자동차/수입차/전기차/브랜드(벤츠·포르쉐·BMW 등)/딜러/모빌리티 관련
- kcc: KCC그룹/KCC정보통신/KCC오토/회사 내부 행사·소식 관련

애매한 경우(예: AI 자율주행)는 'it'로 분류하세요.""",
        ),
    )
    result = response.text.strip().lower()
    if result not in ("it", "auto", "kcc"):
        return "it"
    return result


async def collect_by_keyword(keyword: str) -> list[CollectedArticle]:
    """키워드로 관련 기사를 웹 검색하여 수집"""
    logger.info(f"키워드 기사 수집 시작: {keyword}")

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"'{keyword}'와 관련된 최신 기사를 검색해서 수집해주세요.",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            tools=[types.Tool(google_search=types.GoogleSearch())],
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json.loads(raw)

    articles = [
        CollectedArticle(
            title=a.get("title", ""),
            link=a.get("link", ""),
            description=a.get("description", "")[:500],
            published_date=a.get("published_date", ""),
            source=a.get("source", keyword),
        )
        for a in parsed.get("articles", [])
        if a.get("link", "").startswith("http")  # 유효한 URL만
    ]

    logger.info(f"키워드 수집 완료: {keyword} → {len(articles)}건")
    return articles
