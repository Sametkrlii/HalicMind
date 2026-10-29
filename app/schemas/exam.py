from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class ExamPeriod(BaseModel):
    term_type: Literal['fall', 'spring', 'summer']
    exam_type: Literal['midterm', 'makeup', 'final', 'resit']
    label: str
    start_date: date
    end_date: date


class TermExamCalendar(BaseModel):
    term_id: int
    academic_year: int
    term_type: str
    status: Literal['unavailable', 'calendar_range']
    reason: str | None
    source_url: str | None
    checked_on: date | None
    periods: list[ExamPeriod]
    exams: list[dict]


class ExamSelectionCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    enrollment_id: int = Field(gt=0)
    exam_type: Literal['midterm','final','makeup','resit']
    document_id: int = Field(gt=0)
    sheet: str = Field(min_length=1,max_length=100)
    row_number: int = Field(ge=1,le=20_000_999)
