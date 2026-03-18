import json
import logging
from datetime import datetime

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CuratedArticle, NewsletterArticle, NewsletterContent

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """당신은 수입차 딜러사 KCC오토그룹의 사내 뉴스레터 에디터입니다.
독자는 메르세데스-벤츠, 포르쉐, 재규어, 랜드로버, 혼다, 스텔란티스, 지커, 아우디 등의 영업·서비스 현장 직원입니다.

---

[기사 카테고리별 작성 톤]

차량 소식 (취급 브랜드 신차·업데이트):
- "이번 신차에서 고객이 가장 먼저 물어볼 포인트"를 중심으로 서술
- 사양 변경, 가격, 경쟁 모델 대비 포지셔닝을 간결하게 정리
- 리콜·서비스 캠페인의 경우 고객 안내 시 유의할 점 포함

시장 트렌드 (수입차 시장·소비자 트렌드):
- 판매 수치나 트렌드가 현장 영업에 어떤 의미인지 해석
- "요즘 고객들이 이런 걸 따져본다"는 관점으로 작성
- 경쟁 브랜드 동향은 자사 브랜드와의 비교 관점 포함

정책·전기차 (전기차·기술·정책):
- 복잡한 정책·기술 내용을 고객 응대 언어로 쉽게 풀어쓰기
- "고객이 보조금·충전 얘기 꺼내면 이렇게 답하면 된다" 식의 실용적 관점
- 취급 브랜드의 EV 라인업과 연결해서 설명

---

[필드별 작성 기준]

body (400~600자):
- 첫 문장: 현장 직원이 "이거 알아야겠다" 싶게 만드는 핵심 포인트로 시작
- 중간: 배경·수치·맥락을 1~2문장으로 간결하게
- 끝: 영업·서비스 현장에서 활용할 수 있는 인사이트로 마무리
- 톤: 선배 직원이 팀 단톡에 공유하듯 친근하고 실용적으로

summary (30자 이내):
- 현장 직원이 동료에게 한마디로 전달할 수 있는 핵심
- "~가 바뀐다", "~를 잡아라", "~를 주목하라" 식의 행동 지향적 표현

image_prompt (영어):
- 자동차 관련 미니멀 플랫 일러스트 스타일
- 구체적 오브젝트 포함 (자동차 실루엣, 로고 느낌의 아이콘, 도로, EV 충전기 등)
- 예: "A flat illustration of a luxury car silhouette with a price tag icon, soft grey and blue tones, minimal background"

---

[금지 사항]
- "~에 따르면", "~라고 밝혔다" 같은 보도문 투 금지
- 기사 원문을 그대로 번역하는 방식 금지
- 현장과 무관한 기술적 설명만 늘어놓는 방식 금지
- 결론 없이 사실만 나열하고 끝나는 방식 금지

모든 텍스트는 한국어로 작성 (image_prompt만 영어)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "intro": "이번 주 뉴스레터 인트로 문구 (1~2문장, 현장 직원에게 말 걸듯이)",
  "articles": [
    {
      "headline": "클릭을 유도하는 한국어 헤드라인",
      "body": "400~600자 한국어 본문",
      "summary": "30자 이내 한줄 요약",
      "original_link": "원문 URL",
      "category": "카테고리",
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


async def rewrite_article(article: NewsletterArticle) -> NewsletterArticle:
    """기존 기사 본문을 다른 표현·관점으로 재작성"""
    article_json = json.dumps({
        "original_link": article.original_link,
        "category": article.category,
        "current_headline": article.headline,
        "current_body": article.body,
        "current_summary": article.summary,
    }, ensure_ascii=False, indent=2)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 기사를 다른 표현이나 관점으로 새롭게 작성해주세요:\n\n{article_json}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json.loads(raw)

    if "articles" in parsed:
        data = parsed["articles"][0]
    else:
        data = parsed

    return NewsletterArticle(
        headline=data.get("headline", article.headline),
        body=data.get("body", article.body),
        summary=data.get("summary", article.summary),
        original_link=article.original_link,
        category=article.category,
        image_url=article.image_url,
        image_prompt=data.get("image_prompt", article.image_prompt),
    )


async def write(curated: list[CuratedArticle]) -> NewsletterContent:
    """선별된 자동차 기사로 뉴스레터 본문 작성"""
    curated_json = json.dumps(
        [a.model_dump() for a in curated],
        ensure_ascii=False,
        indent=2,
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 기사들을 뉴스레터로 작성해주세요:\n\n{curated_json}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json.loads(raw)

    # AI가 임의로 카테고리를 바꾸지 않도록 큐레이터가 정한 값 그대로 사용
    articles = [
        NewsletterArticle(**{**a, "category": curated[i].category})
        for i, a in enumerate(parsed["articles"])
    ]
    content = NewsletterContent(
        intro=parsed["intro"],
        articles=articles,
        generated_at=datetime.now().isoformat(),
    )
    logger.info(f"자동차 뉴스레터 작성 완료: {[a.headline for a in content.articles]}")
    return content
