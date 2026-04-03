from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db import get_db
from src.models.user import User
from src.schemas.user import UserResponse
from src.services.employee_link_service import sync_user_employee_link
from src.services.user_profile_service import build_user_response
from src.services.s3_service import upload_profile_image

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/ping")
async def users_ping():
    return {"status": "users router ready"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return build_user_response(db=db, user=user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    login_id: str | None = Form(default=None, min_length=4, max_length=100),
    name: str | None = Form(default=None, min_length=1, max_length=120),
    company_name: str | None = Form(default=None, max_length=120),
    job_title: str | None = Form(default=None, max_length=120),
    profile_image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if login_id is not None and login_id != user.login_id:
        existing_user = db.scalar(
            select(User).where(
                User.login_id == login_id,
                User.id != user.id,
                User.deleted_at.is_(None),
            )
        )
        if existing_user:
            raise HTTPException(status_code=409, detail="Login ID is already in use.")
        user.login_id = login_id

    if name is not None:
        user.name = name
    if company_name is not None:
        user.company_name = company_name
    if job_title is not None:
        user.job_title = job_title
    if profile_image is not None:
        user.profile_image_url = await upload_profile_image(profile_image, str(user.id))

    sync_user_employee_link(db, user)
    db.commit()
    db.refresh(user)
    return build_user_response(db=db, user=user)
