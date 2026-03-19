from pydantic import BaseModel, Field

from src.schemas.user import UserResponse


class SignupResponse(BaseModel):
    message: str
    user: UserResponse


class LoginRequest(BaseModel):
    login_id: str = Field(min_length=4, max_length=100)
    password: str = Field(min_length=8, max_length=100)


class LoginResponse(BaseModel):
    message: str
    user: UserResponse


class PasswordResetRequest(BaseModel):
    login_id: str = Field(min_length=4, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    new_password: str = Field(min_length=8, max_length=100)


class PasswordResetResponse(BaseModel):
    message: str
