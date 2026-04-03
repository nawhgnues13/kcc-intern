from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.employee import Employee
from src.models.user import User
from src.schemas.user import (
    UserEmployeeProfileResponse,
    UserResponse,
    UserUiPermissionsResponse,
)

EXECUTIVE_TITLE_KEYWORDS = (
    "대표",
    "사장",
    "임원",
    "이사",
    "상무",
    "전무",
    "부사장",
    "사장",
)


def _get_linked_employee(db: Session, employee_id: UUID | None) -> Employee | None:
    if employee_id is None:
        return None
    return db.scalar(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.deleted_at.is_(None),
        )
    )


def _has_executive_grooming_access(title: str | None) -> bool:
    normalized = (title or "").strip()
    return any(keyword in normalized for keyword in EXECUTIVE_TITLE_KEYWORDS)


def build_user_ui_permissions(*, user: User, employee: Employee | None) -> UserUiPermissionsResponse:
    if user.role == "admin":
        return UserUiPermissionsResponse(
            can_manage_sales=True,
            can_manage_service=True,
            can_manage_grooming=True,
            can_manage_employees=True,
        )

    company_code = (employee.company_code or "").strip().upper() if employee else ""
    work_unit_type = (employee.work_unit_type or "").strip().lower() if employee else ""
    branch_name = (employee.branch_name or "").strip() if employee else ""
    position = (employee.position or user.job_title or "").strip()

    can_manage_sales = company_code == "KCC_AUTO" and work_unit_type == "showroom"
    can_manage_service = company_code == "KCC_AUTO" and work_unit_type == "service_center"
    can_manage_grooming = (
        company_code == "KCC_INFO"
        and work_unit_type == "biz_group"
        and branch_name == "신규사업TF팀"
    ) or _has_executive_grooming_access(position)

    return UserUiPermissionsResponse(
        can_manage_sales=can_manage_sales,
        can_manage_service=can_manage_service,
        can_manage_grooming=can_manage_grooming,
        can_manage_employees=False,
    )


def build_user_response(*, db: Session, user: User) -> UserResponse:
    employee = _get_linked_employee(db, user.employee_id)
    employee_profile = None
    if employee is not None:
        employee_profile = UserEmployeeProfileResponse(
            employee_id=employee.id,
            company_code=employee.company_code,
            work_unit_type=employee.work_unit_type,
            branch_name=employee.branch_name,
            position=employee.position,
        )

    return UserResponse(
        id=user.id,
        employee_id=user.employee_id,
        login_id=user.login_id,
        name=user.name,
        role=user.role,
        company_name=user.company_name,
        job_title=user.job_title,
        profile_image_url=user.profile_image_url,
        employee_profile=employee_profile,
        ui_permissions=build_user_ui_permissions(user=user, employee=employee),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
