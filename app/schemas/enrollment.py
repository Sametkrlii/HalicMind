from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

from app.core.choices import CourseStatus

Trimmed = Annotated[str, BeforeValidator(lambda value: value.strip() if isinstance(value, str) else value)]


class EnrollmentCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    term_id: int = Field(gt=0)
    course_revision_id: int | None = Field(default=None, gt=0)
    custom_course_code: Trimmed | None = Field(default=None, min_length=1, max_length=100)
    custom_course_name: Trimmed | None = Field(default=None, min_length=1, max_length=500)
    custom_ects: Decimal | None = Field(default=None, ge=0, le=120, max_digits=5, decimal_places=2)
    status: CourseStatus = 'in_progress'
    grade: Trimmed | None = Field(default=None, min_length=1, max_length=20)

    @model_validator(mode='after')
    def valid_source(self):
        if self.grade is not None and self.status in {'in_progress', 'withdrawn'}:
            raise ValueError('Devam eden veya çekilinen derse dönem sonu notu girilemez.')
        if self.course_revision_id is not None:
            if any(value is not None for value in (self.custom_course_code, self.custom_course_name, self.custom_ects)):
                raise ValueError('Katalog dersi ve kişisel ders bilgileri birlikte gönderilemez.')
        elif self.custom_course_code is None or self.custom_course_name is None:
            raise ValueError('Kişisel ders için kod ve ad zorunludur.')
        if self.custom_course_code is not None:
            self.custom_course_code = self.custom_course_code.upper()
            if len(self.custom_course_code) > 100:
                raise ValueError('Ders kodu en fazla 100 karakter olabilir.')
        return self


class EnrollmentUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: CourseStatus | None = None
    grade: Trimmed | None = Field(default=None, min_length=1, max_length=20)
    custom_course_code: Trimmed | None = Field(default=None, min_length=1, max_length=100)
    custom_course_name: Trimmed | None = Field(default=None, min_length=1, max_length=500)
    custom_ects: Decimal | None = Field(default=None, ge=0, le=120, max_digits=5, decimal_places=2)


class EnrollmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    term_id: int
    course_id: int | None
    course_revision_id: int | None
    course_code: str
    course_name: str
    ects: Decimal | None
    status: CourseStatus
    grade: str | None
    archived_at: datetime | None
    created_at: datetime
