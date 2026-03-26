import json
import json_repair
import logging

from google import genai
from google.genai import types

from src.config import settings
from src.models.schemas import NewsletterContent

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)

# ──────────────────────────────────────────────
# 타입별 검수 기준
# ──────────────────────────────────────────────

_IT_AUTO_SYSTEM = """당신은 KCC정보통신·KCC오토그룹 사내 IT/자동차 뉴스레터 품질 검수 에디터입니다.
작성된 뉴스레터 초안을 검토하고 발송 가능 여부를 판단합니다.

독자 프로필:
- KCC정보통신·KCC오토그룹 직원 (개발자부터 영업·서비스 현장 직원까지 다양)
- 바쁜 직장인이 출퇴근 시간에 5분 안에 읽을 수 있는 뉴스레터

검수 기준 (아래 항목을 모두 확인하세요):

1. 본문 길이 (body_length 필드 확인)
   - 각 기사 본문 400자 이상이어야 함
   - 미달 시 해당 기사 번호와 실제 길이 명시

2. 요약 길이 (summary_length 필드 확인)
   - 각 기사 요약 30자 이하이어야 함
   - 초과 시 해당 기사 번호와 실제 길이 명시

3. 주제 다양성
   - 3건 이상의 기사가 사실상 같은 주제(예: 모두 GPT/AI)를 다루고 있으면 탈락
   - 카테고리 이름이 달라도 핵심 소재가 겹치면 문제

4. 글 품질
   - 뉴스 원문을 단순 번역한 수준인지 확인 (인사이트·해석 없이 사실 나열만 있으면 탈락)
   - "~라고 밝혔다", "~에 따르면" 같은 보도문 투 남용 여부
   - 독자에게 실질적인 정보나 시사점을 주는 내용인지

5. 인트로 품질
   - "이번 주도 소식을 전합니다" 같은 형식적 문장이면 탈락
   - 이번 주 흐름의 핵심을 담은 내용인지

6. 독자 적합성
   - 지나치게 해외 독자 중심이거나 한국 직장인과 무관한 내용이 주를 이루면 지적

모든 기준을 통과해야 quality_ok: true입니다.
한 가지라도 미달이면 quality_ok: false로 판단하고, 구체적인 개선 요청을 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "quality_ok": true 또는 false,
  "issues": ["발견된 문제 목록 (구체적으로, 없으면 빈 배열)"],
  "feedback": "에디터에게 전달할 구체적 재작성 요청 (quality_ok가 false일 때만, 어떤 기사의 어떤 부분을 어떻게 고쳐야 하는지 명시)"
}"""

_KCC_SYSTEM = """당신은 KCC그룹 사내 소식지 품질 검수 에디터입니다.
작성된 소식지 초안을 검토하고 발송 가능 여부를 판단합니다.

독자 프로필:
- KCC정보통신·KCC오토그룹 전체 임직원 (개발자부터 영업·서비스 현장 직원까지 다양)
- 바쁜 직장인이 5분 안에 읽을 수 있는 사내 소식지

검수 기준 (아래 항목을 모두 확인하세요):

1. 본문 길이 (body_length 필드 확인)
   - 각 기사 본문 300자 이상이어야 함
   - 미달 시 해당 기사 번호와 실제 길이 명시

2. 요약 길이 (summary_length 필드 확인)
   - 각 기사 요약 30자 이하이어야 함
   - 초과 시 해당 기사 번호와 실제 길이 명시

3. 소식 다양성
   - 모든 기사가 사실상 같은 사건(예: 동일 행사의 다른 측면)만 다루면 지적
   - 각 기사가 서로 다른 소식을 전달하고 있는지 확인

4. 글 품질
   - 블로그 원문을 단순 복사·번역한 수준인지 확인 (임직원 관점의 해석·의미 없이 사실 나열만 있으면 탈락)
   - "~에 따르면", "~라고 밝혔다" 같은 보도문 투 남용 여부
   - 임직원에게 실질적인 의미나 자부심을 줄 수 있는 내용인지

5. 인트로 품질
   - "이번 달도 KCC 소식을 전합니다" 같은 형식적 문장이면 탈락
   - 이번 달 KCC 핵심 소식의 흐름을 담은 내용인지

6. 임직원 적합성
   - 임직원이 아닌 외부 고객 관점으로 쓰인 내용이 주를 이루면 지적
   - KCC 계열사 임직원이 공감할 수 있는 시각으로 작성되었는지

모든 기준을 통과해야 quality_ok: true입니다.
한 가지라도 미달이면 quality_ok: false로 판단하고, 구체적인 개선 요청을 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "quality_ok": true 또는 false,
  "issues": ["발견된 문제 목록 (구체적으로, 없으면 빈 배열)"],
  "feedback": "에디터에게 전달할 구체적 재작성 요청 (quality_ok가 false일 때만, 어떤 기사의 어떤 부분을 어떻게 고쳐야 하는지 명시)"
}"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def review(content: NewsletterContent, newsletter_type: str = "it") -> tuple[bool, str]:
    """뉴스레터 품질 검수.
    newsletter_type: 'it' | 'auto' | 'kcc'
    반환: (통과 여부, 피드백 문자열)
    """
    system = _KCC_SYSTEM if newsletter_type == "kcc" else _IT_AUTO_SYSTEM

    content_json = json.dumps(
        {
            "intro": content.intro,
            "articles": [
                {
                    "index": i + 1,
                    "headline": a.headline,
                    "body": a.body,
                    "summary": a.summary,
                    "category": a.category,
                    "body_length": len(a.body),
                    "summary_length": len(a.summary),
                }
                for i, a in enumerate(content.articles)
            ],
        },
        ensure_ascii=False,
        indent=2,
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"다음 뉴스레터 초안을 검수해주세요:\n\n{content_json}",
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
        ),
    )

    result = _strip_fences(response.text)
    parsed = json_repair.loads(result)
    quality_ok: bool = parsed.get("quality_ok", False)
    issues: list[str] = parsed.get("issues", [])
    feedback: str = parsed.get("feedback", "") if not quality_ok else ""

    if quality_ok:
        logger.info(f"[{newsletter_type}] 품질 검수 통과")
    else:
        logger.warning(f"[{newsletter_type}] 품질 검수 실패 ({len(issues)}건): {issues}")

    return quality_ok, feedback
