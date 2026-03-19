from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db import get_db
from src.models.user import User
from src.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    SignupResponse,
)
from src.schemas.user import UserResponse
from src.services.password_service import hash_password, verify_password
from src.services.s3_service import upload_profile_image

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/ping")
async def auth_ping():
    return {"status": "auth router ready"}


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    login_id: str = Form(..., min_length=4, max_length=100),
    password: str = Form(..., min_length=8, max_length=100),
    name: str = Form(..., min_length=1, max_length=120),
    company_name: str | None = Form(default=None, max_length=120),
    job_title: str | None = Form(default=None, max_length=120),
    profile_image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    existing_user = db.scalar(
        select(User).where(User.login_id == login_id, User.deleted_at.is_(None))
    )
    if existing_user:
        raise HTTPException(status_code=409, detail="이미 사용 중인 로그인 ID입니다.")

    profile_image_url = None
    if profile_image is not None:
        profile_image_url = await upload_profile_image(profile_image, login_id)

    user = User(
        login_id=login_id,
        password=hash_password(password),
        name=name,
        company_name=company_name,
        job_title=job_title,
        profile_image_url=profile_image_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return SignupResponse(message="회원가입이 완료되었습니다.", user=UserResponse.model_validate(user))


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.login_id == payload.login_id, User.deleted_at.is_(None)))
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="로그인 ID 또는 비밀번호가 올바르지 않습니다.")

    return LoginResponse(message="로그인에 성공했습니다.", user=UserResponse.model_validate(user))


@router.post("/password/reset", response_model=PasswordResetResponse)
async def reset_password(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.scalar(
        select(User).where(
            User.login_id == payload.login_id,
            User.name == payload.name,
            User.deleted_at.is_(None),
        )
    )
    if not user:
        raise HTTPException(status_code=404, detail="일치하는 사용자 정보를 찾을 수 없습니다.")

    user.password = hash_password(payload.new_password)
    db.commit()

    return PasswordResetResponse(message="비밀번호가 재설정되었습니다.")
