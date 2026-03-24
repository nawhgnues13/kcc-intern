from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class EmployeeCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    name: str = Field(min_length=1, max_length=120)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    company_code: Optional[str] = Field(default=None, max_length=30)
    department_code: Optional[str] = Field(default=None, max_length=50)
    position: Optional[str] = Field(default=None, max_length=120)
    branch_name: Optional[str] = Field(default=None, max_length=120)


class EmployeeUpdateRequest(EmployeeCreateRequest):
    pass


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)

    employee_id: UUID
    name: str
    email: Optional[str]
    phone: Optional[str]
    company_code: Optional[str]
    department_code: Optional[str]
    position: Optional[str]
    branch_name: Optional[str]
    linked_user_id: Optional[UUID] = None
    linked_user_login_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class EmployeeListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[EmployeeResponse]


class RequestedContentItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    content_format: str = Field(min_length=1, max_length=30)
    template_style: Optional[str] = Field(default=None, max_length=100)


class CreatedTaskSummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    task_id: UUID
    content_format: str
    status: str


class RegistrationPhotoResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    photo_id: UUID
    file_url: str
    photo_description: Optional[str] = None
    sort_order: int


class SalesRegistrationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    sales_registration_id: UUID
    employee_id: UUID
    employee_name: str
    customer_name: str
    customer_phone: Optional[str]
    customer_email: Optional[str]
    vehicle_model: str
    sale_price: Optional[float]
    sale_date: datetime
    branch_name: Optional[str]
    note: Optional[str]
    photos: list[RegistrationPhotoResponse]
    created_tasks: list[CreatedTaskSummaryResponse]
    created_at: datetime
    updated_at: datetime


class SalesRegistrationListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[SalesRegistrationResponse]


class ServiceRegistrationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    service_registration_id: UUID
    employee_id: UUID
    employee_name: str
    customer_name: str
    customer_phone: Optional[str]
    customer_email: Optional[str]
    vehicle_model: str
    service_date: datetime
    repair_details: str
    repair_cost: Optional[float]
    branch_name: Optional[str]
    note: Optional[str]
    photos: list[RegistrationPhotoResponse]
    created_tasks: list[CreatedTaskSummaryResponse]
    created_at: datetime
    updated_at: datetime


class ServiceRegistrationListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[ServiceRegistrationResponse]


class GroomingRegistrationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    grooming_registration_id: UUID
    employee_id: UUID
    employee_name: str
    customer_name: str
    customer_phone: Optional[str]
    customer_email: Optional[str]
    pet_name: str
    pet_type: Optional[str]
    breed: Optional[str]
    grooming_details: str
    price: Optional[float]
    grooming_date: datetime
    branch_name: Optional[str]
    note: Optional[str]
    photos: list[RegistrationPhotoResponse]
    created_tasks: list[CreatedTaskSummaryResponse]
    created_at: datetime
    updated_at: datetime


class GroomingRegistrationListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[GroomingRegistrationResponse]


class ContentTaskListItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    task_id: UUID
    source_type: str
    source_id: UUID
    assigned_employee_id: UUID
    assigned_employee_name: str
    assigned_user_id: Optional[UUID]
    content_format: str
    template_style: Optional[str]
    status: str
    article_id: Optional[UUID]
    title: str
    summary: str
    thumbnail_url: Optional[str]
    event_date: datetime
    created_at: datetime


class ContentTaskListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[ContentTaskListItemResponse]


class ContentResultListItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    task_id: UUID
    article_id: UUID
    article_title: Optional[str]
    source_type: str
    source_id: UUID
    assigned_employee_id: UUID
    assigned_employee_name: str
    assigned_user_id: Optional[UUID]
    content_format: str
    template_style: Optional[str]
    status: str
    customer_name: Optional[str]
    summary: str
    thumbnail_url: Optional[str]
    event_date: datetime
    created_at: datetime
    completed_at: Optional[datetime]


class ContentResultListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    items: list[ContentResultListItemResponse]


class ContentTaskDetailResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    task_id: UUID
    source_type: str
    source_id: UUID
    assigned_employee_id: UUID
    assigned_employee_name: str
    assigned_user_id: Optional[UUID]
    content_format: str
    template_style: Optional[str]
    status: str
    article_id: Optional[UUID]
    title: str
    summary: str
    thumbnail_url: Optional[str]
    event_date: datetime
    source_detail: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ContentTaskUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    status: str = Field(min_length=1, max_length=30)
    article_id: Optional[UUID] = None
