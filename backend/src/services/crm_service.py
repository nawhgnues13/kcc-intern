import json
from datetime import datetime
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.config import settings
from src.models.content_task import ContentTask
from src.models.employee import Employee
from src.models.grooming_registration import GroomingPhoto, GroomingRegistration
from src.models.sales_registration import SalesPhoto, SalesRegistration
from src.models.service_registration import ServicePhoto, ServiceRegistration
from src.models.user import User
from src.schemas.crm import (
    BranchOptionResponse,
    CompanyOptionResponse,
    CreatedTaskSummaryResponse,
    CustomerListResponse,
    CustomerRecipient,
    EmployeeListResponse,
    EmployeeResponse,
    ExternalSalesDeliveryItemResponse,
    ExternalSalesDeliveryListResponse,
    GroomingRegistrationListResponse,
    GroomingRegistrationResponse,
    RegistrationPhotoResponse,
    RequestedContentItem,
    SalesRegistrationListResponse,
    SalesRegistrationResponse,
    SignupCompanyOptionResponse,
    SignupOptionsResponse,
    SignupWorkUnitTypeOptionResponse,
    ServiceRegistrationListResponse,
    ServiceRegistrationResponse,
    WorkUnitTypeOptionResponse,
)
from src.services.content_generation_worker import enqueue_content_tasks
from src.services.content_task_service import ensure_content_tasks
from src.services.employee_link_service import sync_employee_user_link
from src.services.s3_service import upload_newsletter_asset


def _get_employee(db: Session, employee_id: UUID) -> Employee:
    employee = db.scalar(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.deleted_at.is_(None),
        )
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return employee


def _get_user(db: Session, user_id: UUID) -> User:
    user = db.scalar(
        select(User).where(
            User.id == user_id,
            User.deleted_at.is_(None),
        )
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


def _get_employee_for_user(db: Session, user_id: UUID) -> Employee:
    user = _get_user(db, user_id)
    if user.employee_id is None:
        raise HTTPException(status_code=400, detail="User is not linked to an employee.")
    return _get_employee(db, user.employee_id)


def _ensure_unique_employee_email(
    db: Session,
    *,
    email: str | None,
    current_employee_id: UUID | None = None,
) -> None:
    normalized = (email or "").strip().lower()
    if not normalized:
        return

    stmt = select(Employee).where(
        func.lower(Employee.email) == normalized,
        Employee.deleted_at.is_(None),
    )
    if current_employee_id is not None:
        stmt = stmt.where(Employee.id != current_employee_id)

    existing = db.scalar(stmt)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Employee email is already in use.")


def _ensure_unique_sales_external_contract_no(
    db: Session,
    *,
    external_contract_no: str | None,
    current_registration_id: UUID | None = None,
) -> None:
    normalized = (external_contract_no or "").strip()
    if not normalized:
        return

    stmt = select(SalesRegistration).where(
        SalesRegistration.external_contract_no == normalized,
        SalesRegistration.deleted_at.is_(None),
    )
    if current_registration_id is not None:
        stmt = stmt.where(SalesRegistration.id != current_registration_id)

    existing = db.scalar(stmt)
    if existing is not None:
        raise HTTPException(status_code=409, detail="External contract number is already in use.")


def _get_linked_user_map(db: Session, employee_ids: list[UUID]) -> dict[UUID, User]:
    if not employee_ids:
        return {}
    users = list(
        db.scalars(
            select(User).where(
                User.employee_id.in_(employee_ids),
                User.deleted_at.is_(None),
            )
        )
    )
    return {user.employee_id: user for user in users if user.employee_id is not None}


def _to_employee_response(employee: Employee, linked_user: User | None) -> EmployeeResponse:
    return EmployeeResponse(
        employee_id=employee.id,
        name=employee.name,
        email=employee.email,
        phone=employee.phone,
        company_code=employee.company_code,
        department_code=employee.department_code,
        work_unit_type=employee.work_unit_type,
        position=employee.position,
        branch_name=employee.branch_name,
        linked_user_id=linked_user.id if linked_user else None,
        linked_user_login_id=linked_user.login_id if linked_user else None,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
    )


def _normalize_company_code(code: str) -> str:
    """KCC_AUTOGROUP_SERVICE / kcc_autogroup ??KCC_AUTOGROUP (?臾몄옄 + ?????멸렇癒쇳듃)"""
    parts = code.upper().split("_")
    return "_".join(parts[:2])


def _normalize_branch_name_for_match(value: str | None) -> str:
    return "".join((value or "").split())


def _normalize_person_name_for_match(value: str | None) -> str:
    return "".join((value or "").split())


def list_company_codes(*, db: Session) -> list[str]:
    rows = db.execute(
        select(Employee.company_code)
        .where(Employee.deleted_at.is_(None), Employee.company_code.isnot(None))
        .distinct()
        .order_by(Employee.company_code)
    ).scalars().all()
    seen: set[str] = set()
    result: list[str] = []
    for code in rows:
        normalized = _normalize_company_code(code)
        if normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


COMPANY_CODE_LABELS: dict[str, str] = {
    "KCC_INFO": "KCC정보통신",
    "KCC_AUTO": "KCC오토",
    "PODDLY": "포들리",
}

WORK_UNIT_TYPE_LABELS: dict[str, str] = {
    "biz_group": "부서",
    "showroom": "전시장",
    "service_center": "서비스센터",
}

SIGNUP_STATIC_BRANCHES: dict[str, dict[str, list[str]]] = {
    "KCC_INFO": {
        "biz_group": [
            "신규사업TF팀",
            "클라우드사업본부",
            "AX Biz Group",
            "SI 1 Biz Group",
            "SI 2 Biz Group",
            "금융 Biz Group",
            "인프라 Biz Group",
            "정보기술연구소",
        ]
    },
    "KCC_AUTO": {
        "showroom": [
            "강서목동 전시장",
            "강북 전시장",
            "영등포 전시장",
            "부천 전시장",
            "마포 전시장",
            "한남 전시장",
            "제주 전시장",
            "금천 전시장",
            "김포 전시장",
        ],
        "service_center": [],
    },
}


def list_company_options(*, db: Session) -> list[CompanyOptionResponse]:
    return [
        CompanyOptionResponse(code=code, label=COMPANY_CODE_LABELS.get(code, code))
        for code in list_company_codes(db=db)
    ]


def list_work_unit_types(*, db: Session, company_code: str) -> list[WorkUnitTypeOptionResponse]:
    normalized_company = _normalize_company_code(company_code)
    rows = db.execute(
        select(Employee.work_unit_type)
        .where(
            Employee.deleted_at.is_(None),
            func.upper(Employee.company_code) == normalized_company,
            Employee.work_unit_type.isnot(None),
        )
        .distinct()
        .order_by(Employee.work_unit_type)
    ).scalars().all()

    seen: set[str] = set()
    items: list[WorkUnitTypeOptionResponse] = []
    for work_unit_type in rows:
        if work_unit_type in seen:
            continue
        seen.add(work_unit_type)
        items.append(
            WorkUnitTypeOptionResponse(
                code=work_unit_type,
                label=WORK_UNIT_TYPE_LABELS.get(work_unit_type, work_unit_type),
            )
        )
    return items


def list_branch_options(
    *,
    db: Session,
    company_code: str,
    work_unit_type: str | None = None,
) -> list[BranchOptionResponse]:
    stmt = (
        select(Employee.branch_name)
        .where(
            Employee.deleted_at.is_(None),
            Employee.company_code.isnot(None),
            Employee.branch_name.isnot(None),
            Employee.branch_name != "",
        )
        .distinct()
        .order_by(Employee.branch_name)
    )
    if company_code:
        stmt = stmt.where(func.upper(Employee.company_code) == _normalize_company_code(company_code))
    if work_unit_type:
        stmt = stmt.where(Employee.work_unit_type == work_unit_type)

    rows = db.execute(stmt).scalars().all()
    return [BranchOptionResponse(name=branch_name) for branch_name in rows]


def list_signup_options(*, db: Session) -> SignupOptionsResponse:
    companies: list[SignupCompanyOptionResponse] = []
    for company_code, work_unit_map in SIGNUP_STATIC_BRANCHES.items():
        company_work_unit_types: list[SignupWorkUnitTypeOptionResponse] = []
        for work_unit_type, static_branches in work_unit_map.items():
            dynamic_branches = [
                branch.name
                for branch in list_branch_options(
                    db=db,
                    company_code=company_code,
                    work_unit_type=work_unit_type,
                )
            ]
            seen: set[str] = set()
            merged_branches: list[str] = []
            for branch_name in [*static_branches, *dynamic_branches]:
                normalized_branch_name = branch_name.strip()
                if not normalized_branch_name or normalized_branch_name in seen:
                    continue
                seen.add(normalized_branch_name)
                merged_branches.append(normalized_branch_name)

            company_work_unit_types.append(
                SignupWorkUnitTypeOptionResponse(
                    code=work_unit_type,
                    label=WORK_UNIT_TYPE_LABELS.get(work_unit_type, work_unit_type),
                    branches=merged_branches,
                )
            )
        companies.append(
            SignupCompanyOptionResponse(
                code=company_code,
                label=COMPANY_CODE_LABELS.get(company_code, company_code),
                work_unit_types=company_work_unit_types,
            )
        )
    return SignupOptionsResponse(companies=companies)


def list_customers(*, db: Session, employee_email: str | None = None) -> CustomerListResponse:
    employee_id: UUID | None = None
    if employee_email:
        employee = db.scalar(
            select(Employee).where(
                func.lower(Employee.email) == employee_email.strip().lower(),
                Employee.deleted_at.is_(None),
            )
        )
        if not employee:
            return CustomerListResponse(items=[])
        employee_id = employee.id

    def _base_stmt(model, name_col, email_col):
        stmt = select(name_col, email_col).where(
            model.deleted_at.is_(None),
            email_col.isnot(None),
            email_col != "",
        )
        if employee_id:
            stmt = stmt.where(model.employee_id == employee_id)
        return stmt

    rows_sales = db.execute(
        _base_stmt(SalesRegistration, SalesRegistration.customer_name, SalesRegistration.customer_email)
    ).all()
    rows_service = db.execute(
        _base_stmt(ServiceRegistration, ServiceRegistration.customer_name, ServiceRegistration.customer_email)
    ).all()
    rows_grooming = db.execute(
        _base_stmt(GroomingRegistration, GroomingRegistration.customer_name, GroomingRegistration.customer_email)
    ).all()

    seen: set[str] = set()
    items: list[CustomerRecipient] = []
    for name, email in [*rows_sales, *rows_service, *rows_grooming]:
        key = email.lower()
        if key not in seen:
            seen.add(key)
            items.append(CustomerRecipient(name=name, email=email))

    return CustomerListResponse(items=items)


def list_employees(
    *,
    db: Session,
    keyword: str | None = None,
    company_code: str | None = None,
    department_code: str | None = None,
    work_unit_type: str | None = None,
    branch_name: str | None = None,
    is_linked: bool | None = None,
) -> EmployeeListResponse:
    stmt = select(Employee).where(Employee.deleted_at.is_(None))
    if keyword:
        token = f"%{keyword.strip()}%"
        stmt = stmt.where(
            or_(
                Employee.name.ilike(token),
                Employee.email.ilike(token),
                Employee.phone.ilike(token),
            )
        )
    if company_code:
        stmt = stmt.where(func.upper(Employee.company_code) == _normalize_company_code(company_code))
    if department_code:
        stmt = stmt.where(Employee.department_code == department_code)
    if work_unit_type:
        stmt = stmt.where(Employee.work_unit_type == work_unit_type)
    if branch_name:
        stmt = stmt.where(Employee.branch_name == branch_name)

    employees = list(db.scalars(stmt.order_by(Employee.created_at.desc())))
    linked_user_map = _get_linked_user_map(db, [employee.id for employee in employees])
    items = [
        _to_employee_response(employee, linked_user_map.get(employee.id))
        for employee in employees
    ]
    if is_linked is not None:
        items = [item for item in items if (item.linked_user_id is not None) == is_linked]
    return EmployeeListResponse(items=items)


def create_employee(*, db: Session, payload: dict[str, Any]) -> EmployeeResponse:
    _ensure_unique_employee_email(db, email=payload.get("email"))
    employee = Employee(**payload)
    db.add(employee)
    db.flush()
    linked_user = sync_employee_user_link(db, employee)
    db.commit()
    db.refresh(employee)
    return _to_employee_response(employee, linked_user)


def get_employee_detail(*, db: Session, employee_id: UUID) -> EmployeeResponse:
    employee = _get_employee(db, employee_id)
    linked_user_map = _get_linked_user_map(db, [employee.id])
    return _to_employee_response(employee, linked_user_map.get(employee.id))


def delete_employee(*, db: Session, employee_id: UUID) -> None:
    employee = _get_employee(db, employee_id)
    employee.deleted_at = datetime.now()
    db.commit()


def update_employee(*, db: Session, employee_id: UUID, payload: dict[str, Any]) -> EmployeeResponse:
    employee = _get_employee(db, employee_id)
    _ensure_unique_employee_email(
        db,
        email=payload.get("email", employee.email),
        current_employee_id=employee.id,
    )
    for key, value in payload.items():
        setattr(employee, key, value)
    linked_user = sync_employee_user_link(db, employee)
    db.commit()
    db.refresh(employee)
    return _to_employee_response(employee, linked_user)


def parse_requested_contents(raw_value: str | None) -> list[dict[str, str | None]]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="requested_contents must be valid JSON.") from exc
    if not isinstance(parsed, list):
        raise HTTPException(status_code=422, detail="requested_contents must be a JSON array.")

    items: list[dict[str, str | None]] = []
    for item in parsed:
        validated = RequestedContentItem.model_validate(item)
        items.append(
            {
                "content_format": validated.content_format,
                "template_style": validated.template_style,
            }
        )
    return items


def parse_force_regenerate_formats(raw_value: str | None) -> set[str]:
    if raw_value is None or raw_value == "":
        return set()
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="force_regenerate_formats must be valid JSON.") from exc
    if not isinstance(parsed, list):
        raise HTTPException(status_code=422, detail="force_regenerate_formats must be a JSON array.")

    normalized_formats: set[str] = set()
    for item in parsed:
        if not isinstance(item, str):
            raise HTTPException(
                status_code=422,
                detail="force_regenerate_formats must contain strings only.",
            )
        normalized = item.strip().lower()
        if normalized:
            normalized_formats.add(normalized)
    return normalized_formats


def parse_keep_photo_ids(raw_value: str | None) -> list[UUID] | None:
    if raw_value is None:
        return None
    if raw_value == "":
        return []
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="keep_photo_ids must be valid JSON.") from exc
    if not isinstance(parsed, list):
        raise HTTPException(status_code=422, detail="keep_photo_ids must be a JSON array.")
    try:
        return [UUID(str(value)) for value in parsed]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="keep_photo_ids must contain UUID strings.") from exc


def parse_photo_descriptions(raw_value: str | None) -> list[str | None]:
    if raw_value is None or raw_value == "":
        return []
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="photo_descriptions must be valid JSON.") from exc
    if not isinstance(parsed, list):
        raise HTTPException(status_code=422, detail="photo_descriptions must be a JSON array.")

    descriptions: list[str | None] = []
    for item in parsed:
        if item is None:
            descriptions.append(None)
            continue
        if not isinstance(item, str):
            raise HTTPException(
                status_code=422,
                detail="photo_descriptions must contain strings or null values.",
            )
        normalized = item.strip()
        descriptions.append(normalized or None)
    return descriptions


def parse_existing_photo_descriptions(raw_value: str | None) -> dict[UUID, str | None]:
    if raw_value is None or raw_value == "":
        return {}
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail="existing_photo_descriptions must be valid JSON.",
        ) from exc
    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=422,
            detail="existing_photo_descriptions must be a JSON object.",
        )

    descriptions: dict[UUID, str | None] = {}
    for raw_key, raw_value in parsed.items():
        try:
            photo_id = UUID(str(raw_key))
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail="existing_photo_descriptions keys must be UUID strings.",
            ) from exc
        if raw_value is None:
            descriptions[photo_id] = None
            continue
        if not isinstance(raw_value, str):
            raise HTTPException(
                status_code=422,
                detail="existing_photo_descriptions values must be strings or null values.",
            )
        normalized = raw_value.strip()
        descriptions[photo_id] = normalized or None
    return descriptions


def parse_datetime_value(value: str, field_name: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"{field_name} must be a valid ISO datetime.") from exc


def parse_compact_date_value(value: str | None, field_name: str) -> datetime | None:
    normalized = (value or "").strip()
    if not normalized:
        return None
    try:
        return datetime.strptime(normalized, "%Y%m%d")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"{field_name} must be in YYYYMMDD format.") from exc


def _ensure_external_delivery_date_range(delivery_date_from: str, delivery_date_to: str) -> None:
    start_at = parse_compact_date_value(delivery_date_from, "delivery_date_from")
    end_at = parse_compact_date_value(delivery_date_to, "delivery_date_to")
    if start_at is None or end_at is None:
        raise HTTPException(status_code=422, detail="delivery_date_from and delivery_date_to are required.")
    if end_at < start_at:
        raise HTTPException(status_code=422, detail="delivery_date_to must be on or after delivery_date_from.")
    if (end_at - start_at).days > 7:
        raise HTTPException(status_code=422, detail="External CRM lookup supports up to a 7-day range.")


def parse_delivery_payload(raw_value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="delivery_payload must be valid JSON.") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=422, detail="delivery_payload must be a JSON object.")

    contract_no = str(parsed.get("contNo", "")).strip()
    if not contract_no:
        raise HTTPException(status_code=422, detail="delivery_payload.contNo is required.")

    return parsed


async def _upload_crm_images(
    *,
    files: list[UploadFile],
    photo_descriptions: list[str | None],
    entity_key: str,
) -> list[tuple[str, str | None]]:
    uploaded_items: list[tuple[str, str | None]] = []
    for index, file in enumerate(files):
        if not file.filename:
            continue
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are supported.")
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")
        uploaded_url = upload_newsletter_asset(
            file_name=file.filename,
            content_type=file.content_type,
            content=content,
            entity_key=entity_key,
        )
        description = photo_descriptions[index] if index < len(photo_descriptions) else None
        uploaded_items.append((uploaded_url, description))
    return uploaded_items


def _serialize_photo_responses(photos) -> list[RegistrationPhotoResponse]:
    return [
        RegistrationPhotoResponse(
            photo_id=photo.id,
            file_url=photo.file_url,
            photo_description=photo.photo_description,
            sort_order=photo.sort_order,
        )
        for photo in photos
    ]


def _serialize_created_tasks(tasks) -> list[CreatedTaskSummaryResponse]:
    return [
        CreatedTaskSummaryResponse(
            task_id=task.id,
            content_format=task.content_format,
            status=task.status,
            article_id=task.article_id,
        )
        for task in tasks
    ]


def _serialize_sales_registration_response(
    *,
    registration: SalesRegistration,
    photos: list[SalesPhoto],
    tasks: list[Any],
) -> SalesRegistrationResponse:
    return SalesRegistrationResponse(
        sales_registration_id=registration.id,
        employee_id=registration.employee_id,
        employee_name=registration.employee_name,
        external_contract_no=registration.external_contract_no,
        customer_name=registration.customer_name,
        customer_phone=registration.customer_phone,
        customer_email=registration.customer_email,
        vehicle_model=registration.vehicle_model,
        class_name=registration.class_name,
        car_year=registration.car_year,
        exterior_color=registration.exterior_color,
        interior_color=registration.interior_color,
        sale_price=float(registration.sale_price) if registration.sale_price is not None else None,
        invoice_price=float(registration.invoice_price) if registration.invoice_price is not None else None,
        sale_date=registration.sale_date,
        contract_date=registration.contract_date,
        branch_name=registration.branch_name,
        note=registration.note,
        photos=_serialize_photo_responses(photos),
        created_tasks=_serialize_created_tasks(tasks),
        created_at=registration.created_at,
        updated_at=registration.updated_at,
    )


def _build_external_delivery_response(
    *,
    raw_delivery: dict[str, Any],
    existing_registration: SalesRegistration | None,
    generated_contents: list[CreatedTaskSummaryResponse],
) -> ExternalSalesDeliveryItemResponse:
    return ExternalSalesDeliveryItemResponse(
        showroom_name=str(raw_delivery.get("showroomNm", "")).strip(),
        department_name=str(raw_delivery.get("deptNm", "")).strip() or None,
        employee_name=str(raw_delivery.get("empNm", "")).strip(),
        customer_name=str(raw_delivery.get("custNm", "")).strip(),
        external_contract_no=str(raw_delivery.get("contNo", "")).strip(),
        vehicle_model=str(raw_delivery.get("modelNm", "")).strip(),
        class_name=str(raw_delivery.get("classNm", "")).strip() or None,
        car_year=str(raw_delivery.get("carYear", "")).strip() or None,
        exterior_color=str(raw_delivery.get("extColor", "")).strip() or None,
        interior_color=str(raw_delivery.get("inColor", "")).strip() or None,
        sale_price=float(raw_delivery["carPrice"]) if raw_delivery.get("carPrice") not in (None, "") else None,
        invoice_price=float(raw_delivery["invoicePrice"]) if raw_delivery.get("invoicePrice") not in (None, "") else None,
        sale_date=parse_compact_date_value(raw_delivery.get("deliveryDt"), "deliveryDt") or datetime.now(),
        contract_date=parse_compact_date_value(raw_delivery.get("contDt"), "contDt"),
        is_imported=existing_registration is not None,
        sales_registration_id=existing_registration.id if existing_registration else None,
        generated_contents=generated_contents,
        raw_delivery=raw_delivery,
    )


def _get_registration_by_external_contract_no(
    db: Session,
    external_contract_no: str,
) -> SalesRegistration | None:
    normalized = external_contract_no.strip()
    if not normalized:
        return None

    return db.scalar(
        select(SalesRegistration).where(
            SalesRegistration.external_contract_no == normalized,
            SalesRegistration.deleted_at.is_(None),
        )
    )


def _get_active_sale_tasks_by_registration_ids(
    db: Session,
    registration_ids: list[UUID],
) -> dict[UUID, list[ContentTask]]:
    unique_ids = list(dict.fromkeys(registration_ids))
    if not unique_ids:
        return {}

    tasks = list(
        db.scalars(
            select(ContentTask).where(
                ContentTask.source_type == "sale",
                ContentTask.source_id.in_(unique_ids),
                ContentTask.deleted_at.is_(None),
            )
        )
    )
    task_map: dict[UUID, list[ContentTask]] = {registration_id: [] for registration_id in unique_ids}
    for task in tasks:
        task_map.setdefault(task.source_id, []).append(task)
    return task_map


async def list_external_sales_deliveries(
    *,
    db: Session,
    user_id: UUID,
    delivery_date_from: str,
    delivery_date_to: str,
) -> ExternalSalesDeliveryListResponse:
    _ensure_external_delivery_date_range(delivery_date_from, delivery_date_to)

    employee = _get_employee_for_user(db, user_id)
    employee_name = (employee.name or "").strip()
    showroom_name = (employee.branch_name or "").strip()
    normalized_employee_name = _normalize_person_name_for_match(employee_name)
    normalized_showroom_name = _normalize_branch_name_for_match(showroom_name)
    if not employee_name:
        raise HTTPException(status_code=400, detail="Linked employee is missing a name.")
    if not showroom_name:
        raise HTTPException(status_code=400, detail="Linked employee is missing a branch name.")

    if not settings.external_crm_base_url or not settings.external_crm_secret_key:
        raise HTTPException(status_code=500, detail="External CRM integration is not configured.")

    endpoint = settings.external_crm_base_url.rstrip("/") + "/api/interns/deliveries"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                endpoint,
                headers={"secretKey": settings.external_crm_secret_key},
                params={
                    "deliveryDtFrom": delivery_date_from,
                    "deliveryDtTo": delivery_date_to,
                    "empNm": employee_name,
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"External CRM request failed: {exc.__class__.__name__}.") from exc

    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = f"External CRM request failed with status {exc.response.status_code}."
        raise HTTPException(status_code=502, detail=detail) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="External CRM returned invalid JSON.") from exc

    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="External CRM returned an unexpected response shape.")

    candidate_rows = [
        item for item in payload
        if isinstance(item, dict)
        and _normalize_person_name_for_match(str(item.get("empNm", "")).strip()) == normalized_employee_name
    ]

    filtered_rows = [
        item for item in candidate_rows
        if _normalize_branch_name_for_match(str(item.get("showroomNm", "")).strip()) == normalized_showroom_name
    ]
    if not filtered_rows:
        filtered_rows = candidate_rows

    contract_nos = [
        str(item.get("contNo", "")).strip()
        for item in filtered_rows
        if str(item.get("contNo", "")).strip()
    ]
    existing_registrations: list[SalesRegistration] = []
    if contract_nos:
        existing_registrations = list(
            db.scalars(
                select(SalesRegistration).where(
                    SalesRegistration.external_contract_no.in_(contract_nos),
                    SalesRegistration.deleted_at.is_(None),
                )
            )
        )
    existing_map = {
        registration.external_contract_no: registration
        for registration in existing_registrations
        if registration.external_contract_no
    }
    task_map = _get_active_sale_tasks_by_registration_ids(
        db,
        [registration.id for registration in existing_registrations],
    )

    items: list[ExternalSalesDeliveryItemResponse] = []
    for item in filtered_rows:
        contract_no = str(item.get("contNo", "")).strip()
        existing_registration = existing_map.get(contract_no)
        generated_contents = _serialize_created_tasks(
            task_map.get(existing_registration.id, [])
        ) if existing_registration else []
        items.append(
            _build_external_delivery_response(
                raw_delivery=item,
                existing_registration=existing_registration,
                generated_contents=generated_contents,
            )
        )
    items.sort(key=lambda item: item.sale_date, reverse=True)
    return ExternalSalesDeliveryListResponse(items=items)


async def import_external_sales_registration(
    *,
    db: Session,
    user_id: UUID,
    delivery_payload: dict[str, Any],
    note: str | None,
    requested_contents: list[dict[str, str | None]],
    photo_descriptions: list[str | None],
    files: list[UploadFile],
) -> SalesRegistrationResponse:
    employee = _get_employee_for_user(db, user_id)
    contract_no = str(delivery_payload.get("contNo", "")).strip()
    if not contract_no:
        raise HTTPException(status_code=422, detail="delivery_payload.contNo is required.")

    _ensure_unique_sales_external_contract_no(db, external_contract_no=contract_no)

    registration = SalesRegistration(
        employee_id=employee.id,
        employee_name=employee.name,
        external_contract_no=contract_no,
        customer_name=str(delivery_payload.get("custNm", "")).strip(),
        vehicle_model=str(delivery_payload.get("modelNm", "")).strip(),
        class_name=str(delivery_payload.get("classNm", "")).strip() or None,
        car_year=str(delivery_payload.get("carYear", "")).strip() or None,
        exterior_color=str(delivery_payload.get("extColor", "")).strip() or None,
        interior_color=str(delivery_payload.get("inColor", "")).strip() or None,
        sale_price=delivery_payload.get("carPrice") or None,
        invoice_price=delivery_payload.get("invoicePrice") or None,
        sale_date=parse_compact_date_value(delivery_payload.get("deliveryDt"), "deliveryDt") or datetime.now(),
        contract_date=parse_compact_date_value(delivery_payload.get("contDt"), "contDt"),
        branch_name=str(delivery_payload.get("showroomNm", "")).strip() or employee.branch_name,
        note=(note or "").strip() or None,
    )
    db.add(registration)
    db.flush()

    uploaded_items = await _upload_crm_images(
        files=files,
        photo_descriptions=photo_descriptions,
        entity_key=f"sale-{registration.id}",
    )
    for index, (file_url, photo_description) in enumerate(uploaded_items):
        db.add(
            SalesPhoto(
                sales_registration_id=registration.id,
                file_url=file_url,
                photo_description=photo_description,
                sort_order=index,
            )
        )

    created_tasks = ensure_content_tasks(
        db=db,
        source_type="sale",
        source_id=registration.id,
        assigned_employee_id=registration.employee_id,
        requested_contents=requested_contents,
    )

    db.commit()
    _enqueue_recoverable_tasks(created_tasks)
    return get_sales_registration_detail(db=db, registration_id=registration.id)


def _enqueue_recoverable_tasks(tasks) -> None:
    enqueue_content_tasks(
        [
            task.id
            for task in tasks
            if getattr(task, "article_id", None) is None
            and getattr(task, "status", None) in {"pending", "failed"}
        ]
    )


def _list_active_tasks_for_source(db: Session, source_type: str, source_id: UUID):
    from src.models.content_task import ContentTask

    return list(
        db.scalars(
            select(ContentTask).where(
                ContentTask.source_type == source_type,
                ContentTask.source_id == source_id,
                ContentTask.deleted_at.is_(None),
            )
        )
    )


def _soft_delete_registration_tasks(db: Session, source_type: str, source_id: UUID) -> None:
    now = datetime.now()
    tasks = _list_active_tasks_for_source(db, source_type, source_id)
    for task in tasks:
        task.deleted_at = now


def delete_sales_registration(*, db: Session, registration_id: UUID) -> None:
    registration = db.scalar(
        select(SalesRegistration).where(
            SalesRegistration.id == registration_id,
            SalesRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Sales registration not found.")

    now = datetime.now()
    registration.deleted_at = now
    photos = list(
        db.scalars(
            select(SalesPhoto).where(
                SalesPhoto.sales_registration_id == registration.id,
                SalesPhoto.deleted_at.is_(None),
            )
        )
    )
    for photo in photos:
        photo.deleted_at = now
    _soft_delete_registration_tasks(db, "sale", registration.id)
    db.commit()


def delete_service_registration(*, db: Session, registration_id: UUID) -> None:
    registration = db.scalar(
        select(ServiceRegistration).where(
            ServiceRegistration.id == registration_id,
            ServiceRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Service registration not found.")

    now = datetime.now()
    registration.deleted_at = now
    photos = list(
        db.scalars(
            select(ServicePhoto).where(
                ServicePhoto.service_registration_id == registration.id,
                ServicePhoto.deleted_at.is_(None),
            )
        )
    )
    for photo in photos:
        photo.deleted_at = now
    _soft_delete_registration_tasks(db, "service", registration.id)
    db.commit()


def delete_grooming_registration(*, db: Session, registration_id: UUID) -> None:
    registration = db.scalar(
        select(GroomingRegistration).where(
            GroomingRegistration.id == registration_id,
            GroomingRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Grooming registration not found.")

    now = datetime.now()
    registration.deleted_at = now
    photos = list(
        db.scalars(
            select(GroomingPhoto).where(
                GroomingPhoto.grooming_registration_id == registration.id,
                GroomingPhoto.deleted_at.is_(None),
            )
        )
    )
    for photo in photos:
        photo.deleted_at = now
    _soft_delete_registration_tasks(db, "grooming", registration.id)
    db.commit()


def _soft_delete_missing_photos(existing_photos, keep_photo_ids: list[UUID] | None):
    if keep_photo_ids is None:
        return existing_photos

    keep_set = set(keep_photo_ids)
    now = datetime.now()
    kept = []
    for photo in existing_photos:
        if photo.id in keep_set:
            kept.append(photo)
        else:
            photo.deleted_at = now
    return kept


def _apply_existing_photo_descriptions(existing_photos, descriptions: dict[UUID, str | None]) -> None:
    if not descriptions:
        return

    for photo in existing_photos:
        if photo.id in descriptions:
            photo.photo_description = descriptions[photo.id]


async def create_sales_registration(
    *,
    db: Session,
    payload: dict[str, Any],
    requested_contents: list[dict[str, str | None]],
    photo_descriptions: list[str | None],
    files: list[UploadFile],
    force_regenerate_formats: set[str] | None = None,
) -> SalesRegistrationResponse:
    employee = _get_employee(db, payload["employee_id"])
    _ensure_unique_sales_external_contract_no(
        db,
        external_contract_no=payload.get("external_contract_no"),
    )
    registration = SalesRegistration(
        employee_id=employee.id,
        employee_name=employee.name,
        external_contract_no=payload.get("external_contract_no"),
        customer_name=payload["customer_name"],
        customer_phone=payload.get("customer_phone"),
        customer_email=payload.get("customer_email"),
        vehicle_model=payload["vehicle_model"],
        class_name=payload.get("class_name"),
        car_year=payload.get("car_year"),
        exterior_color=payload.get("exterior_color"),
        interior_color=payload.get("interior_color"),
        sale_price=payload.get("sale_price"),
        invoice_price=payload.get("invoice_price"),
        sale_date=payload["sale_date"],
        contract_date=payload.get("contract_date"),
        branch_name=payload.get("branch_name"),
        note=payload.get("note"),
    )
    db.add(registration)
    db.flush()

    uploaded_items = await _upload_crm_images(
        files=files,
        photo_descriptions=photo_descriptions,
        entity_key=f"sale-{registration.id}",
    )
    for index, (file_url, photo_description) in enumerate(uploaded_items):
        db.add(
            SalesPhoto(
                sales_registration_id=registration.id,
                file_url=file_url,
                photo_description=photo_description,
                sort_order=index,
            )
        )

    created_tasks = ensure_content_tasks(
        db=db,
        source_type="sale",
        source_id=registration.id,
        assigned_employee_id=registration.employee_id,
        requested_contents=requested_contents,
        force_regenerate_formats=force_regenerate_formats,
    )

    db.commit()
    _enqueue_recoverable_tasks(created_tasks)
    return get_sales_registration_detail(db=db, registration_id=registration.id)


def list_sales_registrations(*, db: Session) -> SalesRegistrationListResponse:
    registrations = list(
        db.scalars(
            select(SalesRegistration)
            .where(SalesRegistration.deleted_at.is_(None))
            .order_by(SalesRegistration.sale_date.desc(), SalesRegistration.created_at.desc())
        )
    )
    items: list[SalesRegistrationResponse] = []
    for registration in registrations:
        photos = list(
            db.scalars(
                select(SalesPhoto)
                .where(
                    SalesPhoto.sales_registration_id == registration.id,
                    SalesPhoto.deleted_at.is_(None),
                )
                .order_by(SalesPhoto.sort_order.asc(), SalesPhoto.created_at.asc())
            )
        )
        tasks = _list_active_tasks_for_source(db, "sale", registration.id)
        items.append(
            _serialize_sales_registration_response(
                registration=registration,
                photos=photos,
                tasks=tasks,
            )
        )
    return SalesRegistrationListResponse(items=items)


def get_sales_registration_detail(*, db: Session, registration_id: UUID) -> SalesRegistrationResponse:
    registration = db.scalar(
        select(SalesRegistration).where(
            SalesRegistration.id == registration_id,
            SalesRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Sales registration not found.")

    photos = list(
        db.scalars(
            select(SalesPhoto)
            .where(
                SalesPhoto.sales_registration_id == registration.id,
                SalesPhoto.deleted_at.is_(None),
            )
            .order_by(SalesPhoto.sort_order.asc(), SalesPhoto.created_at.asc())
        )
    )
    tasks = _list_active_tasks_for_source(db, "sale", registration.id)
    return _serialize_sales_registration_response(
        registration=registration,
        photos=photos,
        tasks=tasks,
    )


async def update_sales_registration(
    *,
    db: Session,
    registration_id: UUID,
    payload: dict[str, Any],
    requested_contents: list[dict[str, str | None]],
    keep_photo_ids: list[UUID] | None,
    photo_descriptions: list[str | None],
    existing_photo_descriptions: dict[UUID, str | None],
    files: list[UploadFile],
    force_regenerate_formats: set[str] | None = None,
) -> SalesRegistrationResponse:
    registration = db.scalar(
        select(SalesRegistration).where(
            SalesRegistration.id == registration_id,
            SalesRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Sales registration not found.")

    employee = _get_employee(db, payload["employee_id"])
    _ensure_unique_sales_external_contract_no(
        db,
        external_contract_no=payload.get("external_contract_no"),
        current_registration_id=registration.id,
    )
    registration.employee_id = employee.id
    registration.employee_name = employee.name
    registration.external_contract_no = payload.get("external_contract_no")
    registration.customer_name = payload["customer_name"]
    registration.customer_phone = payload.get("customer_phone")
    registration.customer_email = payload.get("customer_email")
    registration.vehicle_model = payload["vehicle_model"]
    registration.class_name = payload.get("class_name")
    registration.car_year = payload.get("car_year")
    registration.exterior_color = payload.get("exterior_color")
    registration.interior_color = payload.get("interior_color")
    registration.sale_price = payload.get("sale_price")
    registration.invoice_price = payload.get("invoice_price")
    registration.sale_date = payload["sale_date"]
    registration.contract_date = payload.get("contract_date")
    registration.branch_name = payload.get("branch_name")
    registration.note = payload.get("note")

    existing_photos = list(
        db.scalars(
            select(SalesPhoto)
            .where(
                SalesPhoto.sales_registration_id == registration.id,
                SalesPhoto.deleted_at.is_(None),
            )
            .order_by(SalesPhoto.sort_order.asc(), SalesPhoto.created_at.asc())
        )
    )
    _apply_existing_photo_descriptions(existing_photos, existing_photo_descriptions)
    kept_photos = _soft_delete_missing_photos(existing_photos, keep_photo_ids)
    uploaded_items = await _upload_crm_images(
        files=files,
        photo_descriptions=photo_descriptions,
        entity_key=f"sale-{registration.id}",
    )
    next_sort_order = len(kept_photos)
    for index, (file_url, photo_description) in enumerate(uploaded_items, start=next_sort_order):
        db.add(
            SalesPhoto(
                sales_registration_id=registration.id,
                file_url=file_url,
                photo_description=photo_description,
                sort_order=index,
            )
        )

    updated_tasks = ensure_content_tasks(
        db=db,
        source_type="sale",
        source_id=registration.id,
        assigned_employee_id=registration.employee_id,
        requested_contents=requested_contents,
        force_regenerate_formats=force_regenerate_formats,
    )
    db.commit()
    _enqueue_recoverable_tasks(updated_tasks)
    return get_sales_registration_detail(db=db, registration_id=registration.id)


async def create_service_registration(
    *,
    db: Session,
    payload: dict[str, Any],
    requested_contents: list[dict[str, str | None]],
    photo_descriptions: list[str | None],
    files: list[UploadFile],
    force_regenerate_formats: set[str] | None = None,
) -> ServiceRegistrationResponse:
    employee = _get_employee(db, payload["employee_id"])
    registration = ServiceRegistration(
        employee_id=employee.id,
        employee_name=employee.name,
        customer_name=payload["customer_name"],
        customer_phone=payload.get("customer_phone"),
        customer_email=payload.get("customer_email"),
        vehicle_model=payload["vehicle_model"],
        service_date=payload["service_date"],
        repair_details=payload["repair_details"],
        repair_cost=payload.get("repair_cost"),
        branch_name=payload.get("branch_name"),
        note=payload.get("note"),
    )
    db.add(registration)
    db.flush()

    uploaded_items = await _upload_crm_images(
        files=files,
        photo_descriptions=photo_descriptions,
        entity_key=f"service-{registration.id}",
    )
    for index, (file_url, photo_description) in enumerate(uploaded_items):
        db.add(
            ServicePhoto(
                service_registration_id=registration.id,
                file_url=file_url,
                photo_description=photo_description,
                sort_order=index,
            )
        )

    created_tasks = ensure_content_tasks(
        db=db,
        source_type="service",
        source_id=registration.id,
        assigned_employee_id=registration.employee_id,
        requested_contents=requested_contents,
        force_regenerate_formats=force_regenerate_formats,
    )

    db.commit()
    _enqueue_recoverable_tasks(created_tasks)
    return get_service_registration_detail(db=db, registration_id=registration.id)


def list_service_registrations(*, db: Session) -> ServiceRegistrationListResponse:
    registrations = list(
        db.scalars(
            select(ServiceRegistration)
            .where(ServiceRegistration.deleted_at.is_(None))
            .order_by(ServiceRegistration.service_date.desc(), ServiceRegistration.created_at.desc())
        )
    )
    items: list[ServiceRegistrationResponse] = []
    for registration in registrations:
        photos = list(
            db.scalars(
                select(ServicePhoto)
                .where(
                    ServicePhoto.service_registration_id == registration.id,
                    ServicePhoto.deleted_at.is_(None),
                )
                .order_by(ServicePhoto.sort_order.asc(), ServicePhoto.created_at.asc())
            )
        )
        tasks = _list_active_tasks_for_source(db, "service", registration.id)
        items.append(
            ServiceRegistrationResponse(
                service_registration_id=registration.id,
                employee_id=registration.employee_id,
                employee_name=registration.employee_name,
                customer_name=registration.customer_name,
                customer_phone=registration.customer_phone,
                customer_email=registration.customer_email,
                vehicle_model=registration.vehicle_model,
                service_date=registration.service_date,
                repair_details=registration.repair_details,
                repair_cost=float(registration.repair_cost) if registration.repair_cost is not None else None,
                branch_name=registration.branch_name,
                note=registration.note,
                photos=_serialize_photo_responses(photos),
                created_tasks=_serialize_created_tasks(tasks),
                created_at=registration.created_at,
                updated_at=registration.updated_at,
            )
        )
    return ServiceRegistrationListResponse(items=items)


def get_service_registration_detail(*, db: Session, registration_id: UUID) -> ServiceRegistrationResponse:
    registration = db.scalar(
        select(ServiceRegistration).where(
            ServiceRegistration.id == registration_id,
            ServiceRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Service registration not found.")

    photos = list(
        db.scalars(
            select(ServicePhoto)
            .where(
                ServicePhoto.service_registration_id == registration.id,
                ServicePhoto.deleted_at.is_(None),
            )
            .order_by(ServicePhoto.sort_order.asc(), ServicePhoto.created_at.asc())
        )
    )
    tasks = _list_active_tasks_for_source(db, "service", registration.id)
    return ServiceRegistrationResponse(
        service_registration_id=registration.id,
        employee_id=registration.employee_id,
        employee_name=registration.employee_name,
        customer_name=registration.customer_name,
        customer_phone=registration.customer_phone,
        customer_email=registration.customer_email,
        vehicle_model=registration.vehicle_model,
        service_date=registration.service_date,
        repair_details=registration.repair_details,
        repair_cost=float(registration.repair_cost) if registration.repair_cost is not None else None,
        branch_name=registration.branch_name,
        note=registration.note,
        photos=_serialize_photo_responses(photos),
        created_tasks=_serialize_created_tasks(tasks),
        created_at=registration.created_at,
        updated_at=registration.updated_at,
    )


async def update_service_registration(
    *,
    db: Session,
    registration_id: UUID,
    payload: dict[str, Any],
    requested_contents: list[dict[str, str | None]],
    keep_photo_ids: list[UUID] | None,
    photo_descriptions: list[str | None],
    existing_photo_descriptions: dict[UUID, str | None],
    files: list[UploadFile],
    force_regenerate_formats: set[str] | None = None,
) -> ServiceRegistrationResponse:
    registration = db.scalar(
        select(ServiceRegistration).where(
            ServiceRegistration.id == registration_id,
            ServiceRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Service registration not found.")

    employee = _get_employee(db, payload["employee_id"])
    registration.employee_id = employee.id
    registration.employee_name = employee.name
    registration.customer_name = payload["customer_name"]
    registration.customer_phone = payload.get("customer_phone")
    registration.customer_email = payload.get("customer_email")
    registration.vehicle_model = payload["vehicle_model"]
    registration.service_date = payload["service_date"]
    registration.repair_details = payload["repair_details"]
    registration.repair_cost = payload.get("repair_cost")
    registration.branch_name = payload.get("branch_name")
    registration.note = payload.get("note")

    existing_photos = list(
        db.scalars(
            select(ServicePhoto)
            .where(
                ServicePhoto.service_registration_id == registration.id,
                ServicePhoto.deleted_at.is_(None),
            )
            .order_by(ServicePhoto.sort_order.asc(), ServicePhoto.created_at.asc())
        )
    )
    _apply_existing_photo_descriptions(existing_photos, existing_photo_descriptions)
    kept_photos = _soft_delete_missing_photos(existing_photos, keep_photo_ids)
    uploaded_items = await _upload_crm_images(
        files=files,
        photo_descriptions=photo_descriptions,
        entity_key=f"service-{registration.id}",
    )
    next_sort_order = len(kept_photos)
    for index, (file_url, photo_description) in enumerate(uploaded_items, start=next_sort_order):
        db.add(
            ServicePhoto(
                service_registration_id=registration.id,
                file_url=file_url,
                photo_description=photo_description,
                sort_order=index,
            )
        )

    updated_tasks = ensure_content_tasks(
        db=db,
        source_type="service",
        source_id=registration.id,
        assigned_employee_id=registration.employee_id,
        requested_contents=requested_contents,
        force_regenerate_formats=force_regenerate_formats,
    )
    db.commit()
    _enqueue_recoverable_tasks(updated_tasks)
    return get_service_registration_detail(db=db, registration_id=registration.id)


async def create_grooming_registration(
    *,
    db: Session,
    payload: dict[str, Any],
    requested_contents: list[dict[str, str | None]],
    photo_descriptions: list[str | None],
    files: list[UploadFile],
    force_regenerate_formats: set[str] | None = None,
) -> GroomingRegistrationResponse:
    employee = _get_employee(db, payload["employee_id"])
    registration = GroomingRegistration(
        employee_id=employee.id,
        employee_name=employee.name,
        customer_name=payload["customer_name"],
        customer_phone=payload.get("customer_phone"),
        customer_email=payload.get("customer_email"),
        pet_name=payload["pet_name"],
        pet_type=payload.get("pet_type"),
        breed=payload.get("breed"),
        grooming_details=payload["grooming_details"],
        price=payload.get("price"),
        grooming_date=payload["grooming_date"],
        branch_name=payload.get("branch_name"),
        note=payload.get("note"),
    )
    db.add(registration)
    db.flush()

    uploaded_items = await _upload_crm_images(
        files=files,
        photo_descriptions=photo_descriptions,
        entity_key=f"grooming-{registration.id}",
    )
    for index, (file_url, photo_description) in enumerate(uploaded_items):
        db.add(
            GroomingPhoto(
                grooming_registration_id=registration.id,
                file_url=file_url,
                photo_description=photo_description,
                sort_order=index,
            )
        )

    created_tasks = ensure_content_tasks(
        db=db,
        source_type="grooming",
        source_id=registration.id,
        assigned_employee_id=registration.employee_id,
        requested_contents=requested_contents,
        force_regenerate_formats=force_regenerate_formats,
    )

    db.commit()
    _enqueue_recoverable_tasks(created_tasks)
    return get_grooming_registration_detail(db=db, registration_id=registration.id)


def list_grooming_registrations(*, db: Session) -> GroomingRegistrationListResponse:
    registrations = list(
        db.scalars(
            select(GroomingRegistration)
            .where(GroomingRegistration.deleted_at.is_(None))
            .order_by(GroomingRegistration.grooming_date.desc(), GroomingRegistration.created_at.desc())
        )
    )
    items: list[GroomingRegistrationResponse] = []
    for registration in registrations:
        photos = list(
            db.scalars(
                select(GroomingPhoto)
                .where(
                    GroomingPhoto.grooming_registration_id == registration.id,
                    GroomingPhoto.deleted_at.is_(None),
                )
                .order_by(GroomingPhoto.sort_order.asc(), GroomingPhoto.created_at.asc())
            )
        )
        tasks = _list_active_tasks_for_source(db, "grooming", registration.id)
        items.append(
            GroomingRegistrationResponse(
                grooming_registration_id=registration.id,
                employee_id=registration.employee_id,
                employee_name=registration.employee_name,
                customer_name=registration.customer_name,
                customer_phone=registration.customer_phone,
                customer_email=registration.customer_email,
                pet_name=registration.pet_name,
                pet_type=registration.pet_type,
                breed=registration.breed,
                grooming_details=registration.grooming_details,
                price=float(registration.price) if registration.price is not None else None,
                grooming_date=registration.grooming_date,
                branch_name=registration.branch_name,
                note=registration.note,
                photos=_serialize_photo_responses(photos),
                created_tasks=_serialize_created_tasks(tasks),
                created_at=registration.created_at,
                updated_at=registration.updated_at,
            )
        )
    return GroomingRegistrationListResponse(items=items)


def get_grooming_registration_detail(*, db: Session, registration_id: UUID) -> GroomingRegistrationResponse:
    registration = db.scalar(
        select(GroomingRegistration).where(
            GroomingRegistration.id == registration_id,
            GroomingRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Grooming registration not found.")

    photos = list(
        db.scalars(
            select(GroomingPhoto)
            .where(
                GroomingPhoto.grooming_registration_id == registration.id,
                GroomingPhoto.deleted_at.is_(None),
            )
            .order_by(GroomingPhoto.sort_order.asc(), GroomingPhoto.created_at.asc())
        )
    )
    tasks = _list_active_tasks_for_source(db, "grooming", registration.id)
    return GroomingRegistrationResponse(
        grooming_registration_id=registration.id,
        employee_id=registration.employee_id,
        employee_name=registration.employee_name,
        customer_name=registration.customer_name,
        customer_phone=registration.customer_phone,
        customer_email=registration.customer_email,
        pet_name=registration.pet_name,
        pet_type=registration.pet_type,
        breed=registration.breed,
        grooming_details=registration.grooming_details,
        price=float(registration.price) if registration.price is not None else None,
        grooming_date=registration.grooming_date,
        branch_name=registration.branch_name,
        note=registration.note,
        photos=_serialize_photo_responses(photos),
        created_tasks=_serialize_created_tasks(tasks),
        created_at=registration.created_at,
        updated_at=registration.updated_at,
    )


async def update_grooming_registration(
    *,
    db: Session,
    registration_id: UUID,
    payload: dict[str, Any],
    requested_contents: list[dict[str, str | None]],
    keep_photo_ids: list[UUID] | None,
    photo_descriptions: list[str | None],
    existing_photo_descriptions: dict[UUID, str | None],
    files: list[UploadFile],
    force_regenerate_formats: set[str] | None = None,
) -> GroomingRegistrationResponse:
    registration = db.scalar(
        select(GroomingRegistration).where(
            GroomingRegistration.id == registration_id,
            GroomingRegistration.deleted_at.is_(None),
        )
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Grooming registration not found.")

    employee = _get_employee(db, payload["employee_id"])
    registration.employee_id = employee.id
    registration.employee_name = employee.name
    registration.customer_name = payload["customer_name"]
    registration.customer_phone = payload.get("customer_phone")
    registration.customer_email = payload.get("customer_email")
    registration.pet_name = payload["pet_name"]
    registration.pet_type = payload.get("pet_type")
    registration.breed = payload.get("breed")
    registration.grooming_details = payload["grooming_details"]
    registration.price = payload.get("price")
    registration.grooming_date = payload["grooming_date"]
    registration.branch_name = payload.get("branch_name")
    registration.note = payload.get("note")

    existing_photos = list(
        db.scalars(
            select(GroomingPhoto)
            .where(
                GroomingPhoto.grooming_registration_id == registration.id,
                GroomingPhoto.deleted_at.is_(None),
            )
            .order_by(GroomingPhoto.sort_order.asc(), GroomingPhoto.created_at.asc())
        )
    )
    _apply_existing_photo_descriptions(existing_photos, existing_photo_descriptions)
    kept_photos = _soft_delete_missing_photos(existing_photos, keep_photo_ids)
    uploaded_items = await _upload_crm_images(
        files=files,
        photo_descriptions=photo_descriptions,
        entity_key=f"grooming-{registration.id}",
    )
    next_sort_order = len(kept_photos)
    for index, (file_url, photo_description) in enumerate(uploaded_items, start=next_sort_order):
        db.add(
            GroomingPhoto(
                grooming_registration_id=registration.id,
                file_url=file_url,
                photo_description=photo_description,
                sort_order=index,
            )
        )

    updated_tasks = ensure_content_tasks(
        db=db,
        source_type="grooming",
        source_id=registration.id,
        assigned_employee_id=registration.employee_id,
        requested_contents=requested_contents,
        force_regenerate_formats=force_regenerate_formats,
    )
    db.commit()
    _enqueue_recoverable_tasks(updated_tasks)
    return get_grooming_registration_detail(db=db, registration_id=registration.id)
