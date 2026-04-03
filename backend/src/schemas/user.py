from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    login_id: str = Field(min_length=4, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    company_name: Optional[str] = Field(default=None, max_length=120)
    job_title: Optional[str] = Field(default=None, max_length=120)
    profile_image_url: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=100)


class UserUpdate(BaseModel):
    login_id: Optional[str] = Field(default=None, min_length=4, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    company_name: Optional[str] = Field(default=None, max_length=120)
    job_title: Optional[str] = Field(default=None, max_length=120)
    profile_image_url: Optional[str] = None


class UserEmployeeProfileResponse(BaseModel):
    employee_id: UUID
    company_code: Optional[str] = None
    work_unit_type: Optional[str] = None
    branch_name: Optional[str] = None
    position: Optional[str] = None


class UserUiPermissionsResponse(BaseModel):
    can_manage_sales: bool = False
    can_manage_service: bool = False
    can_manage_grooming: bool = False
    can_manage_employees: bool = False


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    employee_id: Optional[UUID]
    login_id: str
    name: str
    role: str
    company_name: Optional[str]
    job_title: Optional[str]
    profile_image_url: Optional[str]
    employee_profile: Optional[UserEmployeeProfileResponse] = None
    ui_permissions: UserUiPermissionsResponse = Field(default_factory=UserUiPermissionsResponse)
    created_at: datetime
    updated_at: datetime
