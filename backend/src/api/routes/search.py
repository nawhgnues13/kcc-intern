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
router = APIRouter(prefix="/api/sources/search", tags=["search"])
client = genai.Client(api_key=settings.gemini_api_key)


FAST_SEARCH_INSTRUCTION = """당신은 웹 검색 에이전트입니다.
주어진 키워드나 문장과 관련된 최신 정보를 웹에서 검색하여 최대 10건을 수집하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "results": [
    {
      "title": "페이지 제목",
      "snippet": "핵심 내용 1~2문장 (100자 내외)",
      "original_url": "원본 URL"
    }
  ]
}

규칙:
- title, snippet 모두 반드시 한국어로 작성할 것 (원문이 영어여도 한국어로)
- title에 출처(매체명, 사이트명 등)를 포함하지 말 것 (예: "연합뉴스 - ", " | 한국경제" 같은 표현 제외)
- snippet은 해당 페이지의 핵심 내용을 1~2문장으로 간결하게 요약할 것
- 반드시 실제 존재하는 URL만 사용 (지어내지 말 것)
- 반드시 해당 글/기사의 직접 URL을 사용할 것 (메인 페이지, 카테고리 페이지, 검색 결과 페이지 URL 절대 사용 금지)
- URL을 알 수 없으면 해당 항목 제외
- 최대 10건까지만 반환
- 같은 주제의 중복 항목 제외
- 출처 우선순위: 공신력 있는 뉴스 매체(연합뉴스, 조선일보, 중앙일보, 한국경제, 매일경제, ZDNet, TechCrunch 등), 공식 기업 블로그, 학술/연구 기관 페이지를 우선할 것
- 제외할 출처: 개인 블로그, 뉴스 단순 집계 사이트, 마케팅/광고성 페이지, 내용 없이 링크만 나열하는 사이트"""

SUMMARIZE_INSTRUCTION = """당신은 웹 페이지 분석 전문가입니다.
주어진 URL과 제목의 페이지 내용을 웹에서 검색하여 요약을 제공하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "summary": "핵심 내용 요약 (3~5문장, 200자 이상)"
}

규칙:
- summary는 반드시 한국어로 작성할 것 (원문이 영어여도 한국어로 번역)
- summary 작성 시 절대 포함하지 말 것: 사이트 소개, 매체 정보, 출처 안내 등 — 오직 내용 요약만 작성할 것
- summary는 한 줄이 아닌 3~5문장으로 작성할 것"""


_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}


async def _resolve_url(url: str) -> str:
    """리다이렉트 URL을 실제 원본 URL로 변환"""
    async with httpx.AsyncClient(follow_redirects=True, timeout=3.0, headers=_HEADERS) as http:
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


def _favicon_url(url: str) -> str:
    from urllib.parse import urlparse
    domain = urlparse(url).netloc
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=64"


class SearchRequest(BaseModel):
    query: str
    count: int = Field(default=10, ge=1, le=10)


class SearchResultItem(BaseModel):
    title: str
    snippet: str
    original_url: str
    favicon_url: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total: int


class SummarizeRequest(BaseModel):
    url: str
    title: str = ""


class SummarizeResponse(BaseModel):
    summary: str


@router.post("", response_model=SearchResponse)
async def search(request: SearchRequest):
    """키워드나 문장으로 웹 검색하여 제목/스니펫/URL만 빠르게 반환합니다."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="검색어를 입력해주세요.")

    logger.info(f"검색 요청: {request.query} ({request.count}건)")

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=f"'{request.query}'에 대해 웹에서 검색하고 관련 페이지 {request.count}개를 찾아주세요.",
            config=types.GenerateContentConfig(
                system_instruction=FAST_SEARCH_INSTRUCTION,
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

        results = []
        for item, url in zip(json_items, resolved_urls):
            if not url.startswith("http") or "vertexaisearch" in url:
                continue
            results.append(SearchResultItem(
                title=item.get("title", ""),
                snippet=item.get("snippet", ""),
                original_url=url,
                favicon_url=_favicon_url(url),
            ))

        logger.info(f"검색 완료: {request.query} → {len(results)}건")
        return SearchResponse(query=request.query, results=results, total=len(results))

    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"JSON 파싱 오류: {e}")
        raise HTTPException(status_code=500, detail="검색 결과 파싱에 실패했습니다.")
    except Exception as e:
        logger.error(f"검색 오류: {e}")
        raise HTTPException(status_code=500, detail="검색 중 오류가 발생했습니다.")


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    """단일 URL에 대해 상세 내용과 요약을 생성합니다."""
    if not request.url.strip():
        raise HTTPException(status_code=400, detail="URL을 입력해주세요.")

    logger.info(f"요약 요청: {request.url[:80]}")

    try:
        prompt = f"다음 페이지의 내용을 상세히 분석해주세요.\n제목: {request.title}\nURL: {request.url}"
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SUMMARIZE_INSTRUCTION,
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )

        raw = _strip_json_fences(response.text)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("요약 JSON 파싱 실패, json-repair로 복구 시도")
            parsed = json.loads(repair_json(raw))

        logger.info(f"요약 완료: {request.url[:80]}")
        return SummarizeResponse(summary=parsed.get("summary", ""))

    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"요약 JSON 파싱 오류: {e}")
        raise HTTPException(status_code=500, detail="요약 결과 파싱에 실패했습니다.")
    except Exception as e:
        logger.error(f"요약 오류: {e}")
        raise HTTPException(status_code=500, detail="요약 중 오류가 발생했습니다.")
