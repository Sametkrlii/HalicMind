from fastapi import APIRouter

from app.api.dependencies import CurrentUser, DB
from app.schemas.academic_profile import AcademicProfileRead, AcademicProfileWrite
from app.services import academics

router = APIRouter(prefix='/users/me/academic-profile', tags=['academic profile'])


@router.get('', response_model=AcademicProfileRead)
def get_profile(user: CurrentUser, db: DB):
    return academics.get_profile(db, user.id)


@router.put('', response_model=AcademicProfileRead)
def save_profile(data: AcademicProfileWrite, user: CurrentUser, db: DB):
    return academics.save_profile(db, user.id, data)
