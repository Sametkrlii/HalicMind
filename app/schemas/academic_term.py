from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.choices import PeriodKind, TermType


class TermCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    academic_year: int = Field(ge=1900, le=2200, description='Akademik yılın başlangıcı: 2026 = 2026–2027')
    term_type: TermType
    is_preparation: bool = False
    program_id: int | None = Field(default=None, gt=0)
    curriculum_id: int | None = Field(default=None, gt=0)
    curriculum_period_kind: PeriodKind | None = None
    curriculum_period_number: int | None = Field(default=None, ge=1, le=24)

    @model_validator(mode='after')
    def valid_period(self):
        if self.academic_year > date.today().year + 1:
            raise ValueError('Akademik yıl en fazla gelecek yıl başlayabilir.')
        if (self.program_id is None) != (self.curriculum_id is None):
            raise ValueError('Program ve müfredat birlikte belirtilmelidir.')
        if (self.curriculum_period_kind is None) != (self.curriculum_period_number is None):
            raise ValueError('Müfredat dönem türü ve numarası birlikte belirtilmelidir.')
        if self.is_preparation and self.curriculum_period_kind is not None:
            raise ValueError('Hazırlık dönemi bölüm müfredatının birinci dönemi değildir.')
        if self.curriculum_period_kind == 'year' and self.curriculum_period_number > 12:
            raise ValueError('Yıllık müfredat dönemi en fazla 12 olabilir.')
        return self


class TermUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    academic_year: int | None = Field(default=None, ge=1900, le=2200)
    term_type: TermType | None = None
    curriculum_period_kind: PeriodKind | None = None
    curriculum_period_number: int | None = Field(default=None, ge=1, le=24)


class TermRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    program_id: int
    curriculum_id: int
    academic_year: int
    term_type: TermType
    is_preparation: bool
    curriculum_period_kind: PeriodKind | None
    curriculum_period_number: int | None
    created_at: datetime
