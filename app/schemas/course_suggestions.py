from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.core.choices import PeriodKind


class SuggestedCourse(BaseModel):
    course_revision_id: int
    course_id: int
    course_code: str
    course_name: str
    ects: Decimal | None
    course_type: Literal['required', 'elective']
    elective_group_id: int | None
    elective_group_name: str | None
    verification_status: str


class SuggestedGroup(BaseModel):
    id: int
    name: str
    required_course_count: int | None
    required_ects: Decimal | None


class CourseSuggestions(BaseModel):
    curriculum_id: int
    period_kind: PeriodKind | None
    period_number: int | None
    coverage_status: str
    courses: list[SuggestedCourse]
    elective_groups: list[SuggestedGroup]
    note: str
