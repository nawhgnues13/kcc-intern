import logging
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime

import feedparser
import httpx

from src.models.schemas import CollectedArticle

logger = logging.getLogger(__name__)

KCC_BLOG_RSS = "http://blog.kcc.co.kr/?feed=rss2"


def _parse_date(entry) -> datetime | None:
    for field in ("published", "updated"):
        val = entry.get(field, "")
        if not val:
            continue
        try:
            return parsedate_to_datetime(val).replace(tzinfo=None)
        except Exception:
            pass
        try:
            for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z", "%a, %d %b %Y %H:%M:%S %z"):
                try:
                    dt = datetime.strptime(val, fmt)
                    return dt.replace(tzinfo=None)
                except ValueError:
                    continue
        except Exception:
            pass
    return None


async def collect() -> list[CollectedArticle]:
    """KCC 공식 블로그에서 2026년 1월 1일~오늘 게시글 수집 (테스트용 — 운영 시 전월로 복구)"""
    first_day = datetime(2026, 1, 1)
    last_day = datetime.now()
    articles = []

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(KCC_BLOG_RSS)
            response.raise_for_status()

        feed = feedparser.parse(response.text)
        for entry in feed.entries:
            pub_date = _parse_date(entry)
            if pub_date and not (first_day <= pub_date <= last_day):
                continue
            articles.append(CollectedArticle(
                title=entry.get("title", "").strip(),
                link=entry.get("link", ""),
                description=(entry.get("summary", "") or "")[:500].strip(),
                published_date=entry.get("published", entry.get("updated", "")),
                source="KCC공식블로그",
            ))

        logger.info(f"KCC 블로그 수집 완료: {len(articles)}건 (2026년 1월 1일~오늘)")
    except Exception as e:
        logger.warning(f"KCC 블로그 수집 실패: {e}")

    return articles
