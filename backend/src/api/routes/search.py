import asyncio
import json
import logging

from json_repair import repair_json

import httpx
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from src.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])
client = genai.Client(api_key=settings.gemini_api_key)

SYSTEM_INSTRUCTION = """당신은 웹 검색 에이전트입니다.
주어진 키워드나 문장과 관련된 최신 정보를 웹에서 검색하여 최대 10건을 수집하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "results": [
    {
      "title": "페이지 제목",
      "content": "페이지의 주요 내용을 상세하게 작성 (800자 이상)",
      "summary": "핵심 내용 요약 (3~5문장, 200자 이상)",
      "original_url": "원본 URL"
    }
  ]
}

규칙:
- title, content, summary 모두 반드시 한국어로 작성할 것 (원문이 영어여도 한국어로 번역)
- title에 출처(매체명, 사이트명 등)를 포함하지 말 것 (예: "연합뉴스 - ", " | 한국경제" 같은 표현 제외)
- content는 해당 페이지의 핵심 내용을 충분히 상세하게 작성할 것
- summary는 한 줄이 아닌 3~5문장으로 작성할 것
- 반드시 실제 존재하는 URL만 사용 (지어내지 말 것)
- URL을 알 수 없으면 해당 항목 제외
- 최대 10건까지만 반환
- 같은 주제의 중복 항목 제외"""


_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}


async def _resolve_url(url: str) -> str:
    """리다이렉트 URL을 실제 원본 URL로 변환"""
    async with httpx.AsyncClient(follow_redirects=True, timeout=5.0, headers=_HEADERS) as http:
        try:
            response = await http.head(url)
            resolved = str(response.url)
            logger.debug(f"URL 해석: {url[:60]}... → {resolved[:80]}")
            return resolved
        except Exception as e:
            logger.debug(f"HEAD 실패: {e}")
        try:
            response = await http.get(url)
            resolved = str(response.url)
            logger.debug(f"URL 해석(GET): {url[:60]}... → {resolved[:80]}")
            return resolved
        except Exception as e:
            logger.warning(f"URL 해석 실패: {url[:60]}... ({e})")
            return url


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


def _build_results(json_items: list, resolved_urls: list[str]) -> list["SearchResultItem"]:
    results = []
    for item, url in zip(json_items, resolved_urls):
        if not url.startswith("http") or "vertexaisearch" in url:
            continue
        results.append(SearchResultItem(
            title=item.get("title", ""),
            content=item.get("content", ""),
            summary=item.get("summary", ""),
            original_url=url,
        ))
    return results


class SearchRequest(BaseModel):
    query: str
    count: int = Field(default=10, ge=1, le=10)


class SearchResultItem(BaseModel):
    title: str
    content: str
    summary: str
    original_url: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int


@router.post("", response_model=SearchResponse)
async def search(request: SearchRequest):
    """키워드나 문장으로 웹 검색하여 결과를 반환합니다."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="검색어를 입력해주세요.")

    logger.info(f"검색 요청: {request.query} ({request.count}건)")

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"'{request.query}'에 대해 웹에서 검색하고 관련 페이지 {request.count}개를 찾아주세요.",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )

        raw = _strip_json_fences(response.text)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("JSON 파싱 실패, json-repair로 복구 시도")
            parsed = json.loads(repair_json(raw))
        json_items = parsed.get("results", [])[:request.count]

        resolved_urls = await asyncio.gather(
            *[_resolve_url(item.get("original_url", "")) for item in json_items]
        )

        results = _build_results(json_items, list(resolved_urls))
        logger.info(f"검색 완료: {request.query} → {len(results)}건")

        return SearchResponse(query=request.query, results=results, total=len(results))

    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"JSON 파싱 오류: {e}")
        raise HTTPException(status_code=500, detail="검색 결과 파싱에 실패했습니다.")
    except Exception as e:
        logger.error(f"검색 오류: {e}")
        raise HTTPException(status_code=500, detail="검색 중 오류가 발생했습니다.")
