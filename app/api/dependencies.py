from typing import Annotated

from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.core.web_security import SESSION_COOKIE, validate_web_request
from app.db.session import get_db
from app.models import User

DB = Annotated[Session, Depends(get_db)]
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='api/v1/auth/login', auto_error=False)


def get_current_user(request: Request, db: DB, token: Annotated[str | None, Depends(oauth2_scheme)]) -> User:
    unauthorized = HTTPException(401, 'Geçersiz veya süresi dolmuş oturum.', headers={'WWW-Authenticate': 'Bearer'})
    if token is None:
        token = request.cookies.get(SESSION_COOKIE)
        if token and request.method not in {'GET', 'HEAD', 'OPTIONS'}:
            validate_web_request(request)
    if not token:
        raise unauthorized
    try:
        user_id = decode_access_token(token)
    except InvalidTokenError:
        raise unauthorized from None
    user = db.get(User, user_id)
    if user is None or not user.is_active or user.email_verified_at is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
