import asyncio
import logging
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime

import feedparser
import httpx

from src.models.schemas import CollectedArticle
from src.storage.file_store import save_collected

logger = logging.getLogger(__name__)

RSS_SOURCES = {
    "오토데일리":      "http://www.autodaily.co.kr/rss/allArticle.xml",
    "모터그래프":      "https://www.motorgraph.com/rss/allArticle.xml",
    "헤럴드경제 자동차": "https://biz.heraldcorp.com/rss/category/car.xml",
    "Car and Driver": "https://www.caranddriver.com/rss/all.xml/",
    "Motor Trend":    "https://www.motortrend.com/feed/",
}


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


async def _fetch_feed(client: httpx.AsyncClient, source_name: str, url: str, cutoff: datetime) -> list[CollectedArticle]:
    articles = []
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        feed = feedparser.parse(response.text)
        for entry in feed.entries:
            pub_date = _parse_date(entry)
            if pub_date and pub_date < cutoff:
                continue
            articles.append(CollectedArticle(
                title=entry.get("title", "").strip(),
                link=entry.get("link", ""),
                description=(entry.get("summary", "") or "")[:500].strip(),
                published_date=entry.get("published", entry.get("updated", "")),
                source=source_name,
            ))
        logger.info(f"[{source_name}] {len(articles)}건 수집")
    except Exception as e:
        logger.warning(f"RSS 수집 실패 [{source_name}]: {e}")
    return articles


async def collect() -> list[CollectedArticle]:
    """자동차 RSS 소스에서 최근 7일 기사 수집"""
    cutoff = datetime.now() - timedelta(days=7)
    all_articles: list[CollectedArticle] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [
            _fetch_feed(client, name, url, cutoff)
            for name, url in RSS_SOURCES.items()
        ]
        results = await asyncio.gather(*tasks)

    for articles in results:
        all_articles.extend(articles)

    # 중복 링크 제거
    seen_links = set()
    unique_articles = []
    for a in all_articles:
        if a.link not in seen_links:
            seen_links.add(a.link)
            unique_articles.append(a)

    logger.info(f"자동차 뉴스 수집 완료: {len(unique_articles)}건 (중복 제거 후)")
    save_collected(unique_articles)
    return unique_articles
