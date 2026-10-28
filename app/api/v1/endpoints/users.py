from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.schemas.user import UserRead

router = APIRouter(prefix='/users', tags=['users'])


@router.get('/me', response_model=UserRead)
def me(user: CurrentUser):
    return user
