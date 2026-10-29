from datetime import datetime
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, BeforeValidator, ConfigDict, Field, field_validator, model_validator

from app.core.choices import AssignmentPriority, AssignmentStatus

Trimmed = Annotated[str, BeforeValidator(lambda value: value.strip() if isinstance(value, str) else value)]


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    enrollment_id: int = Field(gt=0)
    title: Trimmed = Field(min_length=1, max_length=200)
    description: Trimmed | None = Field(default=None, max_length=5000)
    due_at: AwareDatetime
    priority: AssignmentPriority = 'normal'
    estimated_minutes: int | None = Field(default=None, ge=1, le=10080)
    status: AssignmentStatus = 'pending'

    @field_validator('due_at')
    @classmethod
    def supported_date(cls, value):
        if not 1900 <= value.year <= 2200:
            raise ValueError('Teslim tarihi 1900–2200 yılları arasında olmalıdır.')
        return value


class AssignmentUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: Trimmed | None = Field(default=None, min_length=1, max_length=200)
    description: Trimmed | None = Field(default=None, max_length=5000)
    due_at: AwareDatetime | None = None
    priority: AssignmentPriority | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=10080)
    status: AssignmentStatus | None = None
    @field_validator('due_at')
    @classmethod
    def supported_date(cls, value):
        return AssignmentCreate.supported_date(value) if value is not None else value

    @model_validator(mode='after')
    def no_null_required_fields(self):
        for field in ('title', 'due_at', 'priority', 'status'):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f'{field} boş olamaz.')
        return self


class AssignmentRead(BaseModel):
    id: int
    user_id: int
    enrollment_id: int
    title: str
    description: str | None
    due_at: datetime
    priority: AssignmentPriority
    estimated_minutes: int | None
    status: AssignmentStatus
    completed_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    course_code: str
    course_name: str
    term_id: int
    course_archived: bool
    is_overdue: bool
