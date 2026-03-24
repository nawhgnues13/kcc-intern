import json
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.models.employee import Employee
from src.models.grooming_registration import GroomingPhoto, GroomingRegistration
from src.models.sales_registration import SalesPhoto, SalesRegistration
from src.models.service_registration import ServicePhoto, ServiceRegistration
from src.models.user import User
from src.schemas.crm import (
    CreatedTaskSummaryResponse,
    EmployeeListResponse,
    EmployeeResponse,
    GroomingRegistrationListResponse,
    GroomingRegistrationResponse,
    RegistrationPhotoResponse,
    RequestedContentItem,
    SalesRegistrationListResponse,
    SalesRegistrationResponse,
    ServiceRegistrationListResponse,
    ServiceRegistrationResponse,
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
        position=employee.position,
        branch_name=employee.branch_name,
        linked_user_id=linked_user.id if linked_user else None,
        linked_user_login_id=linked_user.login_id if linked_user else None,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
    )


def list_employees(
    *,
    db: Session,
    keyword: str | None = None,
    company_code: str | None = None,
    department_code: str | None = None,
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
        stmt = stmt.where(Employee.company_code == company_code)
    if department_code:
        stmt = stmt.where(Employee.department_code == department_code)
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
        )
        for task in tasks
    ]


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
) -> SalesRegistrationResponse:
    employee = _get_employee(db, payload["employee_id"])
    registration = SalesRegistration(
        employee_id=employee.id,
        employee_name=employee.name,
        customer_name=payload["customer_name"],
        customer_phone=payload.get("customer_phone"),
        customer_email=payload.get("customer_email"),
        vehicle_model=payload["vehicle_model"],
        sale_price=payload.get("sale_price"),
        sale_date=payload["sale_date"],
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
            SalesRegistrationResponse(
                sales_registration_id=registration.id,
                employee_id=registration.employee_id,
                employee_name=registration.employee_name,
                customer_name=registration.customer_name,
                customer_phone=registration.customer_phone,
                customer_email=registration.customer_email,
                vehicle_model=registration.vehicle_model,
                sale_price=float(registration.sale_price) if registration.sale_price is not None else None,
                sale_date=registration.sale_date,
                branch_name=registration.branch_name,
                note=registration.note,
                photos=_serialize_photo_responses(photos),
                created_tasks=_serialize_created_tasks(tasks),
                created_at=registration.created_at,
                updated_at=registration.updated_at,
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
    return SalesRegistrationResponse(
        sales_registration_id=registration.id,
        employee_id=registration.employee_id,
        employee_name=registration.employee_name,
        customer_name=registration.customer_name,
        customer_phone=registration.customer_phone,
        customer_email=registration.customer_email,
        vehicle_model=registration.vehicle_model,
        sale_price=float(registration.sale_price) if registration.sale_price is not None else None,
        sale_date=registration.sale_date,
        branch_name=registration.branch_name,
        note=registration.note,
        photos=_serialize_photo_responses(photos),
        created_tasks=_serialize_created_tasks(tasks),
        created_at=registration.created_at,
        updated_at=registration.updated_at,
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
    registration.employee_id = employee.id
    registration.employee_name = employee.name
    registration.customer_name = payload["customer_name"]
    registration.customer_phone = payload.get("customer_phone")
    registration.customer_email = payload.get("customer_email")
    registration.vehicle_model = payload["vehicle_model"]
    registration.sale_price = payload.get("sale_price")
    registration.sale_date = payload["sale_date"]
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
    )
    db.commit()
    _enqueue_recoverable_tasks(updated_tasks)
    return get_grooming_registration_detail(db=db, registration_id=registration.id)
