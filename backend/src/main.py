import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from src.api.routes.auth import router as auth_router
from src.api.routes.newsletters import router as newsletters_router
from src.api.routes.users import router as users_router
from src.config import settings
from src.db import check_db_connection
from src.pipeline.auto_newsletter import run_auto_newsletter_pipeline
from src.pipeline.it_newsletter import run_it_newsletter_pipeline
from src.pipeline.kcc_newsletter import run_kcc_newsletter_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone=ZoneInfo("Asia/Seoul"))


async def _run_kcc_if_first_weekday() -> None:
    """Run the KCC newsletter on the first business day of the month."""
    today = date.today()
    first = today.replace(day=1)
    weekday = first.weekday()
    if weekday < 5:
        first_weekday_day = 1
    elif weekday == 5:
        first_weekday_day = 3
    else:
        first_weekday_day = 2

    if today.day == first_weekday_day:
        logger.info("Running KCC newsletter pipeline for %s", today)
        await run_kcc_newsletter_pipeline()
    else:
        logger.debug(
            "Skipping KCC newsletter pipeline for %s; first business day is %s",
            today,
            first_weekday_day,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    logger.info("KCC scheduler started")
    logger.info("IT scheduler started")
    logger.info("Auto scheduler started")

    if settings.slack_bot_token and settings.slack_app_token:
        from src.services.slack_service import start_socket_mode

        asyncio.create_task(start_socket_mode())
        logger.info("Slack Socket Mode started")
    else:
        logger.info("Slack configuration missing; Socket Mode disabled")

    yield

    scheduler.shutdown()


app = FastAPI(title="AI Newsletter MVP", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(newsletters_router)
app.include_router(users_router)


@app.post("/trigger/it")
async def trigger_it_pipeline():
    asyncio.create_task(run_it_newsletter_pipeline())
    return {"status": "IT newsletter pipeline started"}


@app.post("/trigger/kcc")
async def trigger_kcc_pipeline():
    asyncio.create_task(run_kcc_newsletter_pipeline())
    return {"status": "KCC newsletter pipeline started"}


@app.post("/trigger/auto")
async def trigger_auto_pipeline():
    asyncio.create_task(run_auto_newsletter_pipeline())
    return {"status": "Auto newsletter pipeline started"}


@app.get("/preview/{newsletter_id}", response_class=HTMLResponse)
async def preview_newsletter(newsletter_id: str):
    try:
        from src.services.template_service import render
        from src.storage.file_store import load_newsletter

        stored = load_newsletter(newsletter_id)
        html = render(stored.content, stored.images, newsletter_type=stored.newsletter_type)

        for i in range(len(stored.images)):
            html = html.replace(
                f"cid:article_{i}",
                f"{settings.server_url}/images/{newsletter_id}/{i}",
            )
        return HTMLResponse(content=html)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Newsletter not found.") from exc


@app.get("/images/{newsletter_id}/{index}")
async def serve_image(newsletter_id: str, index: int):
    path = Path(f"data/images/{newsletter_id}_{index}.png")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(path, media_type="image/png")


@app.get("/health")
async def health():
    db_ok = False
    try:
        db_ok = check_db_connection()
    except Exception:
        db_ok = False

    return {
        "status": "ok",
        "kcc_schedule": "monthly first business day 09:00 Asia/Seoul",
        "it_schedule": "every Tuesday 09:00 Asia/Seoul",
        "auto_schedule": "every Thursday 09:00 Asia/Seoul",
        "slack": bool(settings.slack_bot_token),
        "database": db_ok,
    }
