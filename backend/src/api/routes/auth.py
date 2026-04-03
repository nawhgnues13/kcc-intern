import re
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.db import get_db
from src.models.employee import Employee
from src.models.user import User
from src.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    SignupResponse,
)
from src.schemas.user import UserResponse
from src.services.employee_link_service import sync_user_employee_link
from src.services.password_service import hash_password, verify_password
from src.services.user_profile_service import build_user_response
from src.services.s3_service import upload_profile_image

router = APIRouter(prefix="/api/auth", tags=["auth"])

COMPANY_CODE_LABELS: dict[str, str] = {
    "KCC_INFO": "KCC정보통신",
    "KCC_AUTO": "KCC오토",
    "PODDLY": "포들리",
}
LOGIN_ID_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_text(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def _normalize_company_code(value: str | None) -> str | None:
    normalized = _normalize_text(value)
    return normalized.upper() if normalized else None


def _ensure_email_style_login_id(login_id: str) -> None:
    if not LOGIN_ID_EMAIL_REGEX.match(login_id.strip()):
        raise HTTPException(status_code=422, detail="Login ID must be a valid email address.")


def _get_or_create_signup_employee(
    *,
    db: Session,
    name: str,
    company_code: str,
    work_unit_type: str,
    branch_name: str,
) -> Employee:
    employee = db.scalar(
        select(Employee).where(
            Employee.deleted_at.is_(None),
            Employee.name == name,
            func.upper(Employee.company_code) == company_code,
            Employee.work_unit_type == work_unit_type,
            Employee.branch_name == branch_name,
        )
    )
    if employee is not None:
        return employee

    employee = Employee(
        name=name,
        company_code=company_code,
        work_unit_type=work_unit_type,
        branch_name=branch_name,
    )
    db.add(employee)
    db.flush()
    return employee


@router.get("/ping")
async def auth_ping():
    return {"status": "auth router ready"}


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    login_id: str = Form(..., min_length=4, max_length=100),
    password: str = Form(..., min_length=8, max_length=100),
    name: str = Form(..., min_length=1, max_length=120),
    company_code: str | None = Form(default=None, max_length=30),
    work_unit_type: str | None = Form(default=None, max_length=30),
    branch_name: str | None = Form(default=None, max_length=120),
    company_name: str | None = Form(default=None, max_length=120),
    job_title: str | None = Form(default=None, max_length=120),
    employee_id: UUID | None = Form(default=None),
    profile_image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    _ensure_email_style_login_id(login_id)

    existing_user = db.scalar(
        select(User).where(User.login_id == login_id, User.deleted_at.is_(None))
    )
    if existing_user:
        raise HTTPException(status_code=409, detail="Login ID is already in use.")

    normalized_name = _normalize_text(name)
    if normalized_name is None:
        raise HTTPException(status_code=422, detail="Name is required.")

    normalized_company_code = _normalize_company_code(company_code)
    normalized_work_unit_type = _normalize_text(work_unit_type)
    normalized_branch_name = _normalize_text(branch_name)

    employee: Employee | None = None

    if employee_id is not None:
        employee = db.scalar(
            select(Employee).where(
                Employee.id == employee_id,
                Employee.deleted_at.is_(None),
            )
        )
        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found.")

        linked_user = db.scalar(
            select(User).where(
                User.employee_id == employee_id,
                User.deleted_at.is_(None),
            )
        )
        if linked_user is not None:
            raise HTTPException(status_code=409, detail="Employee is already linked to another user.")
    elif normalized_company_code and normalized_work_unit_type and normalized_branch_name:
        employee = _get_or_create_signup_employee(
            db=db,
            name=normalized_name,
            company_code=normalized_company_code,
            work_unit_type=normalized_work_unit_type,
            branch_name=normalized_branch_name,
        )
        linked_user = db.scalar(
            select(User).where(
                User.employee_id == employee.id,
                User.deleted_at.is_(None),
            )
        )
        if linked_user is not None:
            raise HTTPException(status_code=409, detail="Employee is already linked to another user.")

    profile_image_url = None
    if profile_image is not None:
        profile_image_url = await upload_profile_image(profile_image, login_id)

    resolved_company_name = company_name or (
        COMPANY_CODE_LABELS.get(normalized_company_code) if normalized_company_code else None
    )
    resolved_job_title = job_title or (employee.position if employee is not None else None)

    user = User(
        login_id=login_id,
        password=hash_password(password),
        name=normalized_name,
        role="staff",
        company_name=resolved_company_name,
        job_title=resolved_job_title,
        employee_id=employee.id if employee is not None else employee_id,
        profile_image_url=profile_image_url,
    )
    db.add(user)
    db.flush()
    sync_user_employee_link(db, user)
    db.commit()
    db.refresh(user)

    return SignupResponse(
        message="Signup completed successfully.",
        user=build_user_response(db=db, user=user),
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.login_id == payload.login_id, User.deleted_at.is_(None)))
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid login ID or password.")

    return LoginResponse(
        message="Login successful.",
        user=build_user_response(db=db, user=user),
    )


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
        raise HTTPException(status_code=404, detail="Matching user information was not found.")

    user.password = hash_password(payload.new_password)
    db.commit()

    return PasswordResetResponse(message="Password has been reset.")
