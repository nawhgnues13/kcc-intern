import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import date

from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from src.config import settings
from src.pipeline.auto_newsletter import run_auto_newsletter_pipeline
from src.pipeline.it_newsletter import run_it_newsletter_pipeline
from src.pipeline.kcc_newsletter import run_kcc_newsletter_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone=ZoneInfo("Asia/Seoul"))


async def _run_kcc_if_first_weekday():
    """매달 첫 평일에만 KCC 소식지 파이프라인 실행"""
    today = date.today()
    first = today.replace(day=1)
    weekday = first.weekday()  # 0=월 … 4=금, 5=토, 6=일
    if weekday < 5:
        first_weekday_day = 1       # 1일이 평일
    elif weekday == 5:
        first_weekday_day = 3       # 1일이 토요일 → 3일(월)
    else:
        first_weekday_day = 2       # 1일이 일요일 → 2일(월)
    if today.day == first_weekday_day:
        logger.info(f"매달 첫 평일 확인 ({today}) — KCC 소식지 파이프라인 실행")
        await run_kcc_newsletter_pipeline()
    else:
        logger.debug(f"KCC 소식지 스킵 ({today}, 첫 평일: {first_weekday_day}일)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # KCC 소식지: 매달 첫 평일 오전 9시 (1~3일 중 해당일 체크)
    scheduler.add_job(
        _run_kcc_if_first_weekday,
        CronTrigger(hour=9, minute=0, day="1-3", timezone=ZoneInfo("Asia/Seoul")),
        id="kcc_newsletter_pipeline",
    )
    scheduler.add_job(
        run_it_newsletter_pipeline,
        CronTrigger(hour=9, minute=0, day_of_week="tue", timezone=ZoneInfo("Asia/Seoul")),
        id="it_newsletter_pipeline",
    )
    scheduler.add_job(
        run_auto_newsletter_pipeline,
        CronTrigger(hour=9, minute=0, day_of_week="thu", timezone=ZoneInfo("Asia/Seoul")),
        id="auto_newsletter_pipeline",
    )
    scheduler.start()
    logger.info("KCC 소식지 스케줄러 시작 (매달 첫 평일 오전 9시)")
    logger.info("IT 뉴스레터 스케줄러 시작 (매주 화요일 오전 9시)")
    logger.info("자동차 뉴스레터 스케줄러 시작 (매주 목요일 오전 9시)")

    # Slack Socket Mode 시작 (설정된 경우)
    if settings.slack_bot_token and settings.slack_app_token:
        from src.services.slack_service import start_socket_mode
        asyncio.create_task(start_socket_mode())
        logger.info("Slack Socket Mode 시작")
    else:
        logger.info("Slack 미설정 - Socket Mode 비활성화")

    yield

    scheduler.shutdown()


app = FastAPI(title="AI Newsletter MVP", lifespan=lifespan)


@app.post("/trigger/it")
async def trigger_it_pipeline():
    """IT 뉴스레터 파이프라인 수동 실행"""
    asyncio.create_task(run_it_newsletter_pipeline())
    return {"status": "IT 뉴스레터 파이프라인 실행 시작"}


@app.post("/trigger/kcc")
async def trigger_kcc_pipeline():
    """KCC 소식지 파이프라인 수동 실행"""
    asyncio.create_task(run_kcc_newsletter_pipeline())
    return {"status": "KCC 소식지 파이프라인 실행 시작"}


@app.post("/trigger/auto")
async def trigger_auto_pipeline():
    """자동차 뉴스레터 파이프라인 수동 실행"""
    asyncio.create_task(run_auto_newsletter_pipeline())
    return {"status": "자동차 뉴스레터 파이프라인 실행 시작"}


@app.get("/preview/{newsletter_id}", response_class=HTMLResponse)
async def preview_newsletter(newsletter_id: str):
    """뉴스레터 HTML 미리보기 (브라우저에서 렌더링, CID → 실제 URL 치환)"""
    try:
        from src.storage.file_store import load_newsletter
        from src.services.template_service import render
        stored = load_newsletter(newsletter_id)

        # 저장된 HTML 대신 현재 템플릿으로 재렌더링 (템플릿 수정사항 즉시 반영)
        html = render(stored.content, stored.images, newsletter_type=stored.newsletter_type)

        # CID 이미지 참조를 실제 서빙 URL로 치환
        for i in range(len(stored.images)):
            html = html.replace(
                f"cid:article_{i}",
                f"{settings.server_url}/images/{newsletter_id}/{i}",
            )
        return HTMLResponse(content=html)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="뉴스레터를 찾을 수 없습니다.")


@app.get("/images/{newsletter_id}/{index}")
async def serve_image(newsletter_id: str, index: int):
    """생성된 이미지 파일 서빙 (미리보기용)"""
    from pathlib import Path
    path = Path(f"data/images/{newsletter_id}_{index}.png")
    if not path.exists():
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    return FileResponse(path, media_type="image/png")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "kcc_schedule": "매달 첫 평일 오전 9시",
        "it_schedule": "매주 화요일 오전 9시",
        "auto_schedule": "매주 목요일 오전 9시",
        "slack": bool(settings.slack_bot_token),
    }
