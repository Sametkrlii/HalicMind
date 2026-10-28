from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, SecretStr, field_validator

from app.core.email_policy import normalize_student_email

StudentEmail = Annotated[str, BeforeValidator(normalize_student_email)]


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    email: StudentEmail
    full_name: str = Field(min_length=1, max_length=200)
    password: SecretStr = Field(min_length=12, max_length=128)

    @field_validator('full_name', mode='before')
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class ResendVerificationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: StudentEmail


class VerifyEmailRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field(pattern=r'^[A-Za-z0-9_-]{43}$')


class MessageResponse(BaseModel):
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    expires_in: int
