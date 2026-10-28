from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.choices import PreparationStatus


class AcademicProfileWrite(BaseModel):
    model_config = ConfigDict(extra='forbid')
    program_id: int = Field(gt=0)
    curriculum_id: int = Field(gt=0)
    entry_year: int = Field(ge=1900, le=2200)
    current_class: int = Field(ge=0, le=12)
    preparation_status: PreparationStatus = 'not_required'

    @model_validator(mode='after')
    def valid_class(self):
        if self.entry_year > date.today().year + 1:
            raise ValueError('Giriş yılı en fazla gelecek yıl olabilir.')
        if (self.preparation_status == 'in_progress') != (self.current_class == 0):
            raise ValueError('Hazırlık devam ediyorsa sınıf 0; diğer durumlarda en az 1 olmalıdır.')
        return self


class AcademicProfileRead(AcademicProfileWrite):
    model_config = ConfigDict(from_attributes=True)
    user_id: int
    created_at: datetime
    updated_at: datetime
