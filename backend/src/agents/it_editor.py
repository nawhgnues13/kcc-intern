import json
import json_repair
import logging
from datetime import datetime

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import CuratedArticle, NewsletterArticle, NewsletterContent

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """당신은 사내 IT 뉴스레터 에디터입니다.
선별된 기사를 바탕으로, 바쁜 독자가 읽고 싶어지는 뉴스레터를 작성하세요.
독자는 개발자부터 비개발자 직장인까지 다양하므로, 전문 용어는 쉽게 풀어쓰되 깊이는 유지해야 합니다.

---

[기사 카테고리별 작성 톤]

트렌드 (일반인 소프트웨어 / 기술 트렌드):
- 전문 용어 없이, 일상 언어로 작성
- "나한테 어떤 영향이 있나"를 중심으로 서술
- 지나치게 기술적인 설명은 생략

실무 (개발자 소식 / 도구):
- 실무에서 어떻게 쓰이는지 구체적으로 언급
- "이걸 쓰면 뭐가 달라지나"를 명확히
- 기존 도구와의 차이점, 도입 시 고려사항 포함

인사이트 (심층 분석 / 리서치):
- "이게 왜 중요한가"를 중심으로 서술
- 기술적 배경 → 핵심 발견 → 실무 영향 → 앞으로의 전망 순서로 전개
- 예: "단순히 빠른 게 아니라, 기존 방식의 어떤 한계를 깨뜨렸는지"
- 인사이트 기사의 body는 650~800자로 작성 (다른 카테고리보다 길게 — 깊이가 핵심)
- 전문 용어는 반드시 쉽게 풀어서 설명, 비개발자도 이해할 수 있어야 함

---

[필드별 작성 기준]

body:
- 트렌드·실무 카테고리: 450~650자 (검수 기준 400자 이상, 여유 있게 작성)
- 인사이트 카테고리: 650~800자 (깊이 있는 분석이 핵심, 다른 카테고리보다 길게 작성)
- 첫 문장: 독자의 호기심을 자극하는 핵심 포인트로 시작 (단순 사실 나열 금지)
- 중간: 배경 또는 작동 원리를 간결하게 (심층분석은 2~3문장으로 더 자세히)
- 끝: 실무적 시사점 또는 앞으로의 방향으로 마무리
- 톤: 동료에게 슬랙으로 공유하듯 친근하지만 신뢰감 있게

summary (25자 이내, 검수 기준 30자):
- 기사의 핵심을 한 줄로. "~했다" 보단 "~의 시대가 왔다", "~가 바뀐다" 같은 임팩트 있는 표현 사용
- 독자가 body를 읽고 싶어지게 만드는 훅(hook) 역할
- 반드시 25자 이내로 작성할 것 (공백 포함)

image_prompt (영어):
- 미니멀 플랫 일러스트 스타일 유지
- 기사 주제를 상징하는 구체적 오브젝트 포함 (추상적 표현 금지)
- 16:9 가로형 비율로 생성
- 예: "A flat illustration of a shield with a magnifying glass, soft blue tones, minimal background, 16:9 aspect ratio, wide landscape format"

---

[금지 사항]
- "~에 따르면", "~라고 밝혔다" 같은 보도문 투 금지
- 기사 원문을 그대로 번역하는 방식 금지
- 전문 용어를 설명 없이 나열하는 방식 금지
- 결론 없이 사실만 나열하고 끝나는 방식 금지

모든 텍스트는 한국어로 작성 (image_prompt만 영어)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "intro": "이번 주 뉴스레터 인트로 문구 (1~2문장)",
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


async def write(curated: list[CuratedArticle], feedback: str | None = None) -> NewsletterContent:
    """선별된 기사로 뉴스레터 본문 작성. feedback이 있으면 재작성 요청에 반영."""
    curated_json = json.dumps(
        [a.model_dump() for a in curated],
        ensure_ascii=False,
        indent=2,
    )

    prompt = f"다음 기사들을 뉴스레터로 작성해주세요:\n\n{curated_json}"
    if feedback:
        prompt += f"\n\n[품질 검수 피드백 - 반드시 반영하세요]\n{feedback}"

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
        ),
    )

    raw = _strip_json_fences(response.text)
    parsed = json_repair.loads(raw)

    articles = [
        NewsletterArticle(**{**a, "category": curated[i].category})
        for i, a in enumerate(parsed["articles"])
    ]
    content = NewsletterContent(
        intro=parsed["intro"],
        articles=articles,
        generated_at=datetime.now().isoformat(),
    )
    logger.info(f"뉴스레터 작성 완료: {[a.headline for a in content.articles]}")
    return content
