import asyncio
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import select

from src.db import SessionLocal
from src.models.content_task import ContentTask
from src.services.content_task_service import DEFAULT_TEMPLATE_STYLES_BY_FORMAT
from src.services.employee_link_service import get_user_for_employee
from src.services.newsletter_service import generate_newsletter

logger = logging.getLogger(__name__)

RECOVERY_INTERVAL_SECONDS = 60

_task_queue: asyncio.Queue[UUID] | None = None
_consumer_task: asyncio.Task[None] | None = None
_recovery_task: asyncio.Task[None] | None = None
_queued_task_ids: set[UUID] = set()


def _build_auto_instruction(task: ContentTask) -> str:
    return (
        "Automatically generate content from the registered CRM source data and registered photos. "
        f"Source type: {task.source_type}. "
        f"Requested format: {task.content_format}."
    )


def _finalize_completed_task_if_ready(task: ContentTask) -> bool:
    if task.article_id is None:
        return False
    if task.status == "completed":
        return False

    task.status = "completed"
    task.completed_at = datetime.now()
    return True


def _collect_recoverable_task_ids() -> list[UUID]:
    with SessionLocal() as db:
        pending_or_failed_ids = list(
            db.scalars(
                select(ContentTask.id).where(
                    ContentTask.deleted_at.is_(None),
                    ContentTask.article_id.is_(None),
                    ContentTask.status.in_(("pending", "failed", "in_progress")),
                )
            )
        )

        in_progress_tasks = list(
            db.scalars(
                select(ContentTask).where(
                    ContentTask.deleted_at.is_(None),
                    ContentTask.status == "in_progress",
                    ContentTask.article_id.is_not(None),
                )
            )
        )
        finalized = False
        for task in in_progress_tasks:
            finalized = _finalize_completed_task_if_ready(task) or finalized
        if finalized:
            db.commit()

        return pending_or_failed_ids


def enqueue_content_task(task_id: UUID) -> bool:
    if _task_queue is None:
        logger.warning(
            "Content generation queue is not running yet; task %s will be picked up by recovery.",
            task_id,
        )
        return False

    if task_id in _queued_task_ids:
        return False

    _queued_task_ids.add(task_id)
    _task_queue.put_nowait(task_id)
    logger.info("Enqueued content generation task %s", task_id)
    return True


def enqueue_content_tasks(task_ids: list[UUID]) -> int:
    count = 0
    for task_id in task_ids:
        if enqueue_content_task(task_id):
            count += 1
    return count


async def _process_content_task(task_id: UUID) -> None:
    with SessionLocal() as db:
        task = db.scalar(
            select(ContentTask).where(
                ContentTask.id == task_id,
                ContentTask.deleted_at.is_(None),
            )
        )
        if task is None:
            logger.info("Skipping missing content task %s", task_id)
            return

        if _finalize_completed_task_if_ready(task):
            db.commit()
            logger.info("Finalized already-generated content task %s", task_id)
            return

        if task.article_id is not None:
            logger.info("Skipping already linked content task %s", task_id)
            return

        if task.status not in {"pending", "failed", "in_progress"}:
            logger.info("Skipping content task %s with status %s", task_id, task.status)
            return

        if task.assigned_user_id is None:
            linked_user = get_user_for_employee(db, task.assigned_employee_id)
            if linked_user is not None:
                task.assigned_user_id = linked_user.id
                db.commit()
                db.refresh(task)

        if task.assigned_user_id is None:
            logger.warning(
                "Content task %s has no assigned user yet; leaving it pending for later recovery.",
                task_id,
            )
            task.status = "pending"
            db.commit()
            return

        task.status = "in_progress"
        task.completed_at = None
        if not task.template_style:
            task.template_style = DEFAULT_TEMPLATE_STYLES_BY_FORMAT.get(task.content_format)
        db.commit()
        db.refresh(task)

        response = await generate_newsletter(
            db=db,
            user_id=task.assigned_user_id,
            content_task_id=task.id,
            content_format=task.content_format,
            template_style=task.template_style or "",
            instruction=_build_auto_instruction(task),
            urls=[],
            url_names=[],
            files=[],
        )

        db.refresh(task)
        task.article_id = response.article_id
        task.status = "completed"
        task.completed_at = datetime.now()
        db.commit()

        logger.info(
            "Completed content task %s with article %s",
            task_id,
            response.article_id,
        )


async def _consumer_loop() -> None:
    assert _task_queue is not None

    while True:
        task_id = await _task_queue.get()
        try:
            await _process_content_task(task_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Content generation task %s failed", task_id)
            with SessionLocal() as db:
                task = db.scalar(
                    select(ContentTask).where(
                        ContentTask.id == task_id,
                        ContentTask.deleted_at.is_(None),
                    )
                )
                if task is not None and task.article_id is None:
                    task.status = "failed"
                    task.completed_at = None
                    db.commit()
        finally:
            _queued_task_ids.discard(task_id)
            _task_queue.task_done()


async def _recovery_loop() -> None:
    while True:
        try:
            await asyncio.sleep(RECOVERY_INTERVAL_SECONDS)
            recovered_ids = _collect_recoverable_task_ids()
            if recovered_ids:
                enqueue_content_tasks(recovered_ids)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Content generation recovery loop failed")


async def start_content_generation_worker() -> None:
    global _task_queue, _consumer_task, _recovery_task

    if _task_queue is not None:
        return

    _task_queue = asyncio.Queue()
    _consumer_task = asyncio.create_task(
        _consumer_loop(),
        name="content-generation-consumer",
    )
    _recovery_task = asyncio.create_task(
        _recovery_loop(),
        name="content-generation-recovery",
    )

    initial_ids = _collect_recoverable_task_ids()
    if initial_ids:
        enqueue_content_tasks(initial_ids)

    logger.info("Content generation worker started")


async def stop_content_generation_worker() -> None:
    global _task_queue, _consumer_task, _recovery_task

    tasks = [task for task in (_consumer_task, _recovery_task) if task is not None]
    for task in tasks:
        task.cancel()

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

    _task_queue = None
    _consumer_task = None
    _recovery_task = None
    _queued_task_ids.clear()
    logger.info("Content generation worker stopped")
