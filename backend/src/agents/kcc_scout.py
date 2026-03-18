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
    """KCC 공식 블로그에서 전월 게시글 수집"""
    today = datetime.now()
    # 전월 1일 ~ 전월 말일
    first_day_this_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_day_prev_month = first_day_this_month - timedelta(days=1)
    first_day_prev_month = last_day_prev_month.replace(day=1)
    articles = []

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(KCC_BLOG_RSS)
            response.raise_for_status()

        feed = feedparser.parse(response.text)
        for entry in feed.entries:
            pub_date = _parse_date(entry)
            if pub_date and not (first_day_prev_month <= pub_date <= last_day_prev_month):
                continue
            articles.append(CollectedArticle(
                title=entry.get("title", "").strip(),
                link=entry.get("link", ""),
                description=(entry.get("summary", "") or "")[:500].strip(),
                published_date=entry.get("published", entry.get("updated", "")),
                source="KCC공식블로그",
            ))

        logger.info(f"KCC 블로그 수집 완료: {len(articles)}건 ({first_day_prev_month.strftime('%Y년 %m월')})")
    except Exception as e:
        logger.warning(f"KCC 블로그 수집 실패: {e}")

    return articles
