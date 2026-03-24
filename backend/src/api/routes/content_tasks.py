from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db import get_db
from src.schemas.crm import (
    ContentResultListResponse,
    ContentTaskDetailResponse,
    ContentTaskListResponse,
    ContentTaskUpdateRequest,
)
from src.services.content_task_service import (
    get_content_task_detail,
    list_content_tasks,
    list_my_content_results,
    update_content_task,
)

router = APIRouter(prefix="/api/content-tasks", tags=["content-tasks"])


@router.get("", response_model=ContentTaskListResponse)
async def list_content_tasks_route(
    assigned_user_id: UUID | None = None,
    status: str | None = None,
    content_format: str | None = None,
    source_type: str | None = None,
    db: Session = Depends(get_db),
):
    return list_content_tasks(
        db=db,
        assigned_user_id=assigned_user_id,
        status=status,
        content_format=content_format,
        source_type=source_type,
    )


@router.get("/my-results", response_model=ContentResultListResponse)
async def list_my_content_results_route(
    assigned_user_id: UUID,
    content_format: str | None = None,
    source_type: str | None = None,
    db: Session = Depends(get_db),
):
    return list_my_content_results(
        db=db,
        assigned_user_id=assigned_user_id,
        content_format=content_format,
        source_type=source_type,
    )


@router.get("/{task_id}", response_model=ContentTaskDetailResponse)
async def get_content_task_detail_route(task_id: UUID, db: Session = Depends(get_db)):
    return get_content_task_detail(db=db, task_id=task_id)


@router.patch("/{task_id}", response_model=ContentTaskDetailResponse)
async def update_content_task_route(
    task_id: UUID,
    payload: ContentTaskUpdateRequest,
    db: Session = Depends(get_db),
):
    return update_content_task(
        db=db,
        task_id=task_id,
        status=payload.status,
        article_id=payload.article_id,
    )
