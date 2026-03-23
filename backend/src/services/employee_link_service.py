from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.models.content_task import ContentTask
from src.models.employee import Employee
from src.models.user import User


def _normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    return normalized or None


def _find_employee_by_login_id(db: Session, login_id: str | None) -> Optional[Employee]:
    normalized = _normalize_email(login_id)
    if not normalized:
        return None

    return db.scalar(
        select(Employee).where(
            func.lower(Employee.email) == normalized,
            Employee.deleted_at.is_(None),
        )
    )


def _find_user_by_employee_email(db: Session, email: str | None) -> Optional[User]:
    normalized = _normalize_email(email)
    if not normalized:
        return None

    return db.scalar(
        select(User).where(
            func.lower(User.login_id) == normalized,
            User.deleted_at.is_(None),
        )
    )


def _has_other_user_link(db: Session, employee_id, current_user_id) -> bool:
    existing = db.scalar(
        select(User).where(
            User.employee_id == employee_id,
            User.id != current_user_id,
            User.deleted_at.is_(None),
        )
    )
    return existing is not None


def _assign_open_tasks(db: Session, employee_id, user_id) -> None:
    tasks = list(
        db.scalars(
            select(ContentTask).where(
                ContentTask.assigned_employee_id == employee_id,
                ContentTask.assigned_user_id.is_(None),
                ContentTask.deleted_at.is_(None),
            )
        )
    )
    for task in tasks:
        task.assigned_user_id = user_id


def sync_user_employee_link(db: Session, user: User) -> Optional[Employee]:
    if user.employee_id is not None:
        employee = db.scalar(
            select(Employee).where(
                Employee.id == user.employee_id,
                Employee.deleted_at.is_(None),
            )
        )
        if employee:
            _assign_open_tasks(db, employee.id, user.id)
        return employee

    employee = _find_employee_by_login_id(db, user.login_id)
    if employee is None:
        return None
    if _has_other_user_link(db, employee.id, user.id):
        return None

    user.employee_id = employee.id
    _assign_open_tasks(db, employee.id, user.id)
    return employee


def sync_employee_user_link(db: Session, employee: Employee) -> Optional[User]:
    user = _find_user_by_employee_email(db, employee.email)
    if user is None:
        return None
    if user.employee_id is not None and user.employee_id != employee.id:
        return None
    if _has_other_user_link(db, employee.id, user.id):
        return None

    user.employee_id = employee.id
    _assign_open_tasks(db, employee.id, user.id)
    return user


def get_user_for_employee(db: Session, employee_id) -> Optional[User]:
    return db.scalar(
        select(User).where(
            User.employee_id == employee_id,
            User.deleted_at.is_(None),
        )
    )
