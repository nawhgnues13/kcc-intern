from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db import get_db
from src.schemas.crm import EmployeeCreateRequest, EmployeeListResponse, EmployeeResponse, EmployeeUpdateRequest
from src.services.crm_service import create_employee, get_employee_detail, list_employees, update_employee

router = APIRouter(prefix="/api/employees", tags=["employees"])


@router.get("", response_model=EmployeeListResponse)
async def list_employees_route(
    keyword: str | None = None,
    company_code: str | None = None,
    department_code: str | None = None,
    branch_name: str | None = None,
    is_linked: bool | None = None,
    db: Session = Depends(get_db),
):
    return list_employees(
        db=db,
        keyword=keyword,
        company_code=company_code,
        department_code=department_code,
        branch_name=branch_name,
        is_linked=is_linked,
    )


@router.post("", response_model=EmployeeResponse)
async def create_employee_route(payload: EmployeeCreateRequest, db: Session = Depends(get_db)):
    return create_employee(db=db, payload=payload.model_dump())


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee_detail_route(employee_id: UUID, db: Session = Depends(get_db)):
    return get_employee_detail(db=db, employee_id=employee_id)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee_route(
    employee_id: UUID,
    payload: EmployeeUpdateRequest,
    db: Session = Depends(get_db),
):
    return update_employee(
        db=db,
        employee_id=employee_id,
        payload=payload.model_dump(exclude_none=True),
    )
