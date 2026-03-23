import json
import logging
from datetime import datetime

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CuratedArticle, NewsletterArticle, NewsletterContent

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """당신은 KCC그룹 사내 소식지 에디터입니다.
독자는 KCC정보통신·KCC오토그룹 등 KCC 계열사 전체 임직원입니다.

목표: KCC 공식 블로그의 이번 주 소식을 임직원이 빠르게 파악할 수 있도록 정리합니다.

---

[작성 기준]

body (300~500자):
- 첫 문장: 이 소식이 왜 중요한지, 무엇이 달라지는지 핵심을 먼저
- 중간: 배경·주요 내용을 간결하게 (수치, 브랜드명, 이벤트명 등 구체적 정보 포함)
- 끝: 임직원 관점에서 어떤 의미인지 한 줄로 마무리
- 톤: 공식적이지만 딱딱하지 않게, 사내 공지 느낌으로

summary (30자 이내):
- 이 소식을 한 줄로 전달할 때 쓸 수 있는 표현
- "~달성", "~출시", "~시작" 등 명확한 동사로 끝내기

image_prompt (영어):
- KCC 기업 이미지에 맞는 미니멀 플랫 일러스트
- 소식 내용을 상징하는 오브젝트 포함 (자동차, 건물, 트로피, 악수 등)
- 예: "A flat illustration of a modern office building with a small trophy icon, navy and white tones, minimal background"

---

[금지 사항]
- "~에 따르면", "~라고 밝혔다" 같은 보도문 투 금지
- 원문을 그대로 번역하는 방식 금지
- 결론 없이 사실만 나열하고 끝나는 방식 금지

모든 텍스트는 한국어로 작성 (image_prompt만 영어)

입력된 게시글 수만큼 articles 배열을 작성하세요. (게시글이 5건이면 5건 모두 작성)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "intro": "이번 주 KCC 소식 인트로 (1~2문장, 임직원에게 말 걸듯이)",
  "articles": [
    {
      "headline": "임직원의 관심을 끄는 한국어 헤드라인",
      "body": "300~500자 한국어 본문",
      "summary": "30자 이내 한줄 요약",
      "original_link": "원문 URL",
      "category": "회사소식",
      "image_prompt": "Minimalist flat illustration, ..."
    }
  ]
}"""


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()



async def write(curated: list[CuratedArticle]) -> NewsletterContent:
    """선별된 KCC 블로그 게시글로 소식지 본문 작성"""
    curated_json = json.dumps(
        [a.model_dump() for a in curated],
        ensure_ascii=False,
        indent=2,
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 KCC 블로그 게시글들을 사내 소식지로 작성해주세요:\n\n{curated_json}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json.loads(raw)

    articles = [
        NewsletterArticle(**{**a, "category": curated[i].category})
        for i, a in enumerate(parsed["articles"])
    ]
    content = NewsletterContent(
        intro=parsed["intro"],
        articles=articles,
        generated_at=datetime.now().isoformat(),
    )
    logger.info(f"KCC 소식지 작성 완료: {[a.headline for a in content.articles]}")
    return content
