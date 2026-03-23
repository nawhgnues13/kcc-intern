from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.article import Article
from src.models.content_task import ContentTask
from src.models.grooming_registration import GroomingPhoto, GroomingRegistration
from src.models.sales_registration import SalesPhoto, SalesRegistration
from src.models.service_registration import ServicePhoto, ServiceRegistration
from src.schemas.crm import (
    ContentTaskDetailResponse,
    ContentTaskListItemResponse,
    ContentTaskListResponse,
)
from src.services.employee_link_service import get_user_for_employee

ALLOWED_TASK_SOURCE_TYPES = {"sale", "service", "grooming"}
ALLOWED_TASK_CONTENT_FORMATS = {"blog", "instagram", "newsletter"}
ALLOWED_TASK_STATUSES = {"pending", "in_progress", "completed", "skipped"}


def _serialize_photo(
    *,
    photo_id: UUID,
    file_url: str,
    photo_description: str | None,
    sort_order: int,
) -> dict[str, Any]:
    return {
        "photoId": photo_id,
        "fileUrl": file_url,
        "photoDescription": photo_description,
        "sortOrder": sort_order,
    }


def _shorten(value: str | None, limit: int = 80) -> str:
    if not value:
        return ""

    normalized = " ".join(value.split()).strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def _load_sales_source(db: Session, source_id: UUID) -> dict[str, Any]:
    registration = db.scalar(
        select(SalesRegistration).where(
            SalesRegistration.id == source_id,
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
    serialized_photos = [
        _serialize_photo(
            photo_id=photo.id,
            file_url=photo.file_url,
            photo_description=photo.photo_description,
            sort_order=photo.sort_order,
        )
        for photo in photos
    ]
    thumbnail = serialized_photos[0]["fileUrl"] if serialized_photos else None
    summary = " / ".join(
        part
        for part in [
            registration.customer_name,
            registration.vehicle_model,
            registration.branch_name,
        ]
        if part
    )
    detail = {
        "registrationId": registration.id,
        "employeeId": registration.employee_id,
        "employeeName": registration.employee_name,
        "customerName": registration.customer_name,
        "customerPhone": registration.customer_phone,
        "customerEmail": registration.customer_email,
        "vehicleModel": registration.vehicle_model,
        "salePrice": float(registration.sale_price) if registration.sale_price is not None else None,
        "saleDate": registration.sale_date,
        "branchName": registration.branch_name,
        "note": registration.note,
        "photos": serialized_photos,
    }
    source_text = (
        "Source type: vehicle purchase\n"
        f"Employee: {registration.employee_name}\n"
        f"Customer: {registration.customer_name}\n"
        f"Vehicle model: {registration.vehicle_model}\n"
        f"Sale price: {registration.sale_price}\n"
        f"Sale date: {registration.sale_date.isoformat()}\n"
        f"Branch: {registration.branch_name or ''}\n"
        f"Note: {registration.note or ''}"
    )
    described_photos = [photo["photoDescription"] for photo in serialized_photos if photo.get("photoDescription")]
    if described_photos:
        source_text += "\nPhoto descriptions:\n" + "\n".join(
            f"- {description}" for description in described_photos
        )
    return {
        "detail": detail,
        "title": f"{registration.vehicle_model} purchase content",
        "summary": summary,
        "thumbnailUrl": thumbnail,
        "eventDate": registration.sale_date,
        "topic": "automotive",
        "sourceText": source_text,
        "imageUrls": [photo["fileUrl"] for photo in serialized_photos],
        "assignedEmployeeId": registration.employee_id,
        "assignedEmployeeName": registration.employee_name,
    }


def _load_service_source(db: Session, source_id: UUID) -> dict[str, Any]:
    registration = db.scalar(
        select(ServiceRegistration).where(
            ServiceRegistration.id == source_id,
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
    serialized_photos = [
        _serialize_photo(
            photo_id=photo.id,
            file_url=photo.file_url,
            photo_description=photo.photo_description,
            sort_order=photo.sort_order,
        )
        for photo in photos
    ]
    thumbnail = serialized_photos[0]["fileUrl"] if serialized_photos else None
    summary = " / ".join(
        part
        for part in [
            registration.vehicle_model,
            _shorten(registration.repair_details, limit=40),
            registration.branch_name,
        ]
        if part
    )
    detail = {
        "registrationId": registration.id,
        "employeeId": registration.employee_id,
        "employeeName": registration.employee_name,
        "customerName": registration.customer_name,
        "customerPhone": registration.customer_phone,
        "customerEmail": registration.customer_email,
        "vehicleModel": registration.vehicle_model,
        "serviceDate": registration.service_date,
        "repairDetails": registration.repair_details,
        "repairCost": float(registration.repair_cost) if registration.repair_cost is not None else None,
        "branchName": registration.branch_name,
        "note": registration.note,
        "photos": serialized_photos,
    }
    source_text = (
        "Source type: vehicle service\n"
        f"Employee: {registration.employee_name}\n"
        f"Customer: {registration.customer_name}\n"
        f"Vehicle model: {registration.vehicle_model}\n"
        f"Service date: {registration.service_date.isoformat()}\n"
        f"Repair details: {registration.repair_details}\n"
        f"Repair cost: {registration.repair_cost}\n"
        f"Branch: {registration.branch_name or ''}\n"
        f"Note: {registration.note or ''}"
    )
    described_photos = [photo["photoDescription"] for photo in serialized_photos if photo.get("photoDescription")]
    if described_photos:
        source_text += "\nPhoto descriptions:\n" + "\n".join(
            f"- {description}" for description in described_photos
        )
    return {
        "detail": detail,
        "title": f"{registration.vehicle_model} service content",
        "summary": summary,
        "thumbnailUrl": thumbnail,
        "eventDate": registration.service_date,
        "topic": "automotive",
        "sourceText": source_text,
        "imageUrls": [photo["fileUrl"] for photo in serialized_photos],
        "assignedEmployeeId": registration.employee_id,
        "assignedEmployeeName": registration.employee_name,
    }


def _load_grooming_source(db: Session, source_id: UUID) -> dict[str, Any]:
    registration = db.scalar(
        select(GroomingRegistration).where(
            GroomingRegistration.id == source_id,
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
    serialized_photos = [
        _serialize_photo(
            photo_id=photo.id,
            file_url=photo.file_url,
            photo_description=photo.photo_description,
            sort_order=photo.sort_order,
        )
        for photo in photos
    ]
    thumbnail = serialized_photos[0]["fileUrl"] if serialized_photos else None
    summary = " / ".join(
        part
        for part in [
            registration.pet_name,
            registration.breed,
            registration.branch_name,
        ]
        if part
    )
    detail = {
        "registrationId": registration.id,
        "employeeId": registration.employee_id,
        "employeeName": registration.employee_name,
        "customerName": registration.customer_name,
        "customerPhone": registration.customer_phone,
        "customerEmail": registration.customer_email,
        "petName": registration.pet_name,
        "petType": registration.pet_type,
        "breed": registration.breed,
        "groomingDetails": registration.grooming_details,
        "price": float(registration.price) if registration.price is not None else None,
        "groomingDate": registration.grooming_date,
        "branchName": registration.branch_name,
        "note": registration.note,
        "photos": serialized_photos,
    }
    source_text = (
        "Source type: pet grooming\n"
        f"Employee: {registration.employee_name}\n"
        f"Customer: {registration.customer_name}\n"
        f"Pet name: {registration.pet_name}\n"
        f"Pet type: {registration.pet_type or ''}\n"
        f"Breed: {registration.breed or ''}\n"
        f"Grooming date: {registration.grooming_date.isoformat()}\n"
        f"Grooming details: {registration.grooming_details}\n"
        f"Price: {registration.price}\n"
        f"Branch: {registration.branch_name or ''}\n"
        f"Note: {registration.note or ''}"
    )
    described_photos = [photo["photoDescription"] for photo in serialized_photos if photo.get("photoDescription")]
    if described_photos:
        source_text += "\nPhoto descriptions:\n" + "\n".join(
            f"- {description}" for description in described_photos
        )
    return {
        "detail": detail,
        "title": f"{registration.pet_name} grooming content",
        "summary": summary,
        "thumbnailUrl": thumbnail,
        "eventDate": registration.grooming_date,
        "topic": "pet",
        "sourceText": source_text,
        "imageUrls": [photo["fileUrl"] for photo in serialized_photos],
        "assignedEmployeeId": registration.employee_id,
        "assignedEmployeeName": registration.employee_name,
    }


def load_source_bundle(db: Session, source_type: str, source_id: UUID) -> dict[str, Any]:
    if source_type == "sale":
        return _load_sales_source(db, source_id)
    if source_type == "service":
        return _load_service_source(db, source_id)
    if source_type == "grooming":
        return _load_grooming_source(db, source_id)
    raise HTTPException(status_code=400, detail="Unsupported source type.")


def get_content_task(db: Session, task_id: UUID) -> ContentTask:
    task = db.scalar(
        select(ContentTask).where(
            ContentTask.id == task_id,
            ContentTask.deleted_at.is_(None),
        )
    )
    if not task:
        raise HTTPException(status_code=404, detail="Content task not found.")
    return task


def ensure_content_tasks(
    *,
    db: Session,
    source_type: str,
    source_id: UUID,
    assigned_employee_id: UUID,
    requested_contents: list[dict[str, str | None]],
) -> list[ContentTask]:
    if source_type not in ALLOWED_TASK_SOURCE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported source type.")

    linked_user = get_user_for_employee(db, assigned_employee_id)
    results: list[ContentTask] = []
    seen_formats: set[str] = set()

    for item in requested_contents:
        content_format = (item.get("content_format") or "").strip().lower()
        template_style = (item.get("template_style") or "").strip() or None

        if not content_format:
            continue
        if content_format not in ALLOWED_TASK_CONTENT_FORMATS:
            raise HTTPException(status_code=400, detail="Unsupported content format.")
        if content_format in seen_formats:
            continue
        seen_formats.add(content_format)

        existing = db.scalar(
            select(ContentTask).where(
                ContentTask.source_type == source_type,
                ContentTask.source_id == source_id,
                ContentTask.content_format == content_format,
                ContentTask.deleted_at.is_(None),
            )
        )
        if existing:
            existing.assigned_employee_id = assigned_employee_id
            existing.assigned_user_id = linked_user.id if linked_user else None
            existing.template_style = template_style
            results.append(existing)
            continue

        task = ContentTask(
            source_type=source_type,
            source_id=source_id,
            assigned_employee_id=assigned_employee_id,
            assigned_user_id=linked_user.id if linked_user else None,
            content_format=content_format,
            template_style=template_style,
            status="pending",
        )
        db.add(task)
        db.flush()
        results.append(task)

    return results


def _build_task_list_item(
    *,
    task: ContentTask,
    source_bundle: dict[str, Any],
) -> ContentTaskListItemResponse:
    return ContentTaskListItemResponse(
        task_id=task.id,
        source_type=task.source_type,
        source_id=task.source_id,
        assigned_employee_id=task.assigned_employee_id,
        assigned_employee_name=source_bundle["assignedEmployeeName"],
        assigned_user_id=task.assigned_user_id,
        content_format=task.content_format,
        template_style=task.template_style,
        status=task.status,
        article_id=task.article_id,
        title=source_bundle["title"],
        summary=source_bundle["summary"],
        thumbnail_url=source_bundle["thumbnailUrl"],
        event_date=source_bundle["eventDate"],
        created_at=task.created_at,
    )


def list_content_tasks(
    *,
    db: Session,
    assigned_user_id: UUID | None = None,
    status: str | None = None,
    content_format: str | None = None,
    source_type: str | None = None,
) -> ContentTaskListResponse:
    stmt = select(ContentTask).where(ContentTask.deleted_at.is_(None))
    if assigned_user_id is not None:
        stmt = stmt.where(ContentTask.assigned_user_id == assigned_user_id)
    if status:
        stmt = stmt.where(ContentTask.status == status)
    if content_format:
        stmt = stmt.where(ContentTask.content_format == content_format)
    if source_type:
        stmt = stmt.where(ContentTask.source_type == source_type)

    tasks = list(db.scalars(stmt.order_by(ContentTask.created_at.desc())))
    items = [
        _build_task_list_item(
            task=task,
            source_bundle=load_source_bundle(db, task.source_type, task.source_id),
        )
        for task in tasks
    ]
    return ContentTaskListResponse(items=items)


def get_content_task_detail(*, db: Session, task_id: UUID) -> ContentTaskDetailResponse:
    task = get_content_task(db, task_id)
    source_bundle = load_source_bundle(db, task.source_type, task.source_id)
    return ContentTaskDetailResponse(
        task_id=task.id,
        source_type=task.source_type,
        source_id=task.source_id,
        assigned_employee_id=task.assigned_employee_id,
        assigned_employee_name=source_bundle["assignedEmployeeName"],
        assigned_user_id=task.assigned_user_id,
        content_format=task.content_format,
        template_style=task.template_style,
        status=task.status,
        article_id=task.article_id,
        title=source_bundle["title"],
        summary=source_bundle["summary"],
        thumbnail_url=source_bundle["thumbnailUrl"],
        event_date=source_bundle["eventDate"],
        source_detail=source_bundle["detail"],
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def update_content_task(
    *,
    db: Session,
    task_id: UUID,
    status: str,
    article_id: UUID | None = None,
) -> ContentTaskDetailResponse:
    task = get_content_task(db, task_id)
    if status not in ALLOWED_TASK_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported task status.")

    if article_id is not None:
        article = db.scalar(
            select(Article).where(
                Article.id == article_id,
                Article.deleted_at.is_(None),
            )
        )
        if not article:
            raise HTTPException(status_code=404, detail="Linked article not found.")
        task.article_id = article_id

    task.status = status
    task.completed_at = datetime.now() if status == "completed" else None
    db.commit()
    return get_content_task_detail(db=db, task_id=task.id)


def get_generation_context_for_task(*, db: Session, task_id: UUID) -> dict[str, Any]:
    task = get_content_task(db, task_id)
    source_bundle = load_source_bundle(db, task.source_type, task.source_id)
    return {
        "task": task,
        "source_bundle": source_bundle,
        "instruction_prefix": (
            "You are generating content from a CRM business source.\n"
            f"Content task source type: {task.source_type}\n"
            f"Requested content format: {task.content_format}\n"
            f"Template style: {task.template_style or ''}\n"
            "Use the following source data as the factual basis.\n\n"
            f"{source_bundle['sourceText']}"
        ),
        "image_urls": source_bundle["imageUrls"],
        "topic": source_bundle["topic"],
    }
