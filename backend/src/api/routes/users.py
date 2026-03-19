from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db import get_db
from src.models.user import User
from src.schemas.user import UserResponse
from src.services.s3_service import upload_profile_image

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/ping")
async def users_ping():
    return {"status": "users router ready"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    name: str | None = Form(default=None, min_length=1, max_length=120),
    company_name: str | None = Form(default=None, max_length=120),
    job_title: str | None = Form(default=None, max_length=120),
    profile_image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if name is not None:
        user.name = name
    if company_name is not None:
        user.company_name = company_name
    if job_title is not None:
        user.job_title = job_title
    if profile_image is not None:
        user.profile_image_url = await upload_profile_image(profile_image, str(user.id))

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)
