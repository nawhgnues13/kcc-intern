from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db import get_db
from src.schemas.crm import (
    BranchOptionResponse,
    CompanyOptionResponse,
    EmployeeCreateRequest,
    EmployeeListResponse,
    EmployeeResponse,
    SignupOptionsResponse,
    EmployeeUpdateRequest,
    WorkUnitTypeOptionResponse,
)
from src.services.crm_service import (
    create_employee,
    delete_employee,
    get_employee_detail,
    list_branch_options,
    list_company_codes,
    list_company_options,
    list_employees,
    list_signup_options,
    list_work_unit_types,
    update_employee,
)

router = APIRouter(prefix="/api/employees", tags=["employees"])


@router.get("", response_model=EmployeeListResponse)
async def list_employees_route(
    keyword: str | None = None,
    company_code: str | None = None,
    department_code: str | None = None,
    work_unit_type: str | None = None,
    branch_name: str | None = None,
    is_linked: bool | None = None,
    db: Session = Depends(get_db),
):
    return list_employees(
        db=db,
        keyword=keyword,
        company_code=company_code,
        department_code=department_code,
        work_unit_type=work_unit_type,
        branch_name=branch_name,
        is_linked=is_linked,
    )


@router.post("", response_model=EmployeeResponse)
async def create_employee_route(payload: EmployeeCreateRequest, db: Session = Depends(get_db)):
    return create_employee(db=db, payload=payload.model_dump())


@router.get("/company-codes", response_model=list[str])
async def list_company_codes_route(db: Session = Depends(get_db)):
    return list_company_codes(db=db)


@router.get("/companies", response_model=list[CompanyOptionResponse])
async def list_company_options_route(db: Session = Depends(get_db)):
    return list_company_options(db=db)


@router.get("/signup-options", response_model=SignupOptionsResponse)
async def list_signup_options_route(db: Session = Depends(get_db)):
    return list_signup_options(db=db)


@router.get("/work-unit-types", response_model=list[WorkUnitTypeOptionResponse])
async def list_work_unit_types_route(
    company_code: str,
    db: Session = Depends(get_db),
):
    return list_work_unit_types(db=db, company_code=company_code)


@router.get("/branches", response_model=list[BranchOptionResponse])
async def list_branch_options_route(
    company_code: str,
    work_unit_type: str | None = None,
    db: Session = Depends(get_db),
):
    return list_branch_options(
        db=db,
        company_code=company_code,
        work_unit_type=work_unit_type,
    )


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


@router.delete("/{employee_id}", status_code=204)
async def delete_employee_route(employee_id: UUID, db: Session = Depends(get_db)):
    delete_employee(db=db, employee_id=employee_id)
