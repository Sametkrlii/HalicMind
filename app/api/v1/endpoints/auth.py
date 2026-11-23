from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from fastapi.security import OAuth2PasswordRequestForm

from app.api.dependencies import DB
from app.core.config import settings
from app.core.security import create_access_token
from app.core.web_security import SESSION_COOKIE, validate_web_request
from app.schemas.auth import MessageResponse, PasswordResetRequest, ResetCodeResponse, RegisterRequest, ResendVerificationRequest, TokenResponse, VerifyEmailRequest
from app.services import auth
from app.services.auth_limits import enforce_limit
from app.services.mail import VerificationMailer, get_mailer

router = APIRouter(prefix='/auth', tags=['auth'])
Mailer = Annotated[VerificationMailer, Depends(get_mailer)]


def client_ip(request: Request) -> str:
    # Do not trust user-supplied X-Forwarded-For headers. Configure trusted
    # proxies in the ASGI server when deploying behind a reverse proxy.
    return request.client.host if request.client else 'unknown'


@router.post('/register', response_model=MessageResponse, status_code=201)
def register(data: RegisterRequest, request: Request, db: DB, mailer: Mailer):
    enforce_limit(db, 'register-ip', client_ip(request), 5, 300)
    enforce_limit(db, 'verification-email', data.email, 1, 60)
    auth.register_user(db, data, mailer)
    return {'message': 'Hesabınız oluşturuldu. E-postanıza gönderilen kodla adresinizi doğrulayın.'}


@router.post('/resend-verification', response_model=MessageResponse, status_code=202)
def resend(data: ResendVerificationRequest, request: Request, db: DB, mailer: Mailer):
    enforce_limit(db, 'resend-ip', client_ip(request), 5, 300)
    enforce_limit(db, 'verification-email', data.email, 1, 60)
    enforce_limit(db, 'verification-email-hour', data.email, 5, 3600)
    auth.resend_verification(db, data.email, mailer)
    return {'message': 'Uygun bir hesap varsa doğrulama e-postası gönderildi.'}


@router.post('/verify-email', response_model=MessageResponse)
def verify(data: VerifyEmailRequest, request: Request, db: DB):
    enforce_limit(db, 'verify-ip', client_ip(request), 20, 60)
    auth.verify_email(db, data.token)
    return {'message': 'E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.'}


@router.post('/forgot-password', response_model=ResetCodeResponse, status_code=202)
def forgot_password(data: ResendVerificationRequest, request: Request, tasks: BackgroundTasks, db: DB, mailer: Mailer):
    cooldown = 60
    enforce_limit(db, 'reset-request-ip', client_ip(request), 10, 300)
    enforce_limit(db, 'reset-request-email', data.email, 1, cooldown)
    enforce_limit(db, 'reset-request-hour', data.email, 5, 3600)
    token = auth.issue_reset_code(db, data.email)
    if token:
        tasks.add_task(auth.deliver_reset_code, mailer, data.email, token)
    return {'message': 'Bu adresle etkin bir hesap varsa parola sıfırlama kodu e-postayla gönderilir.',
            'retry_after': cooldown}


@router.post('/reset-password', response_model=MessageResponse)
def reset_password(data: PasswordResetRequest, request: Request, db: DB):
    enforce_limit(db, 'reset-confirm-ip', client_ip(request), 20, 60)
    auth.reset_password(db, data.token, data.password.get_secret_value())
    return {'message': 'Parolan güncellendi. Yeni parolanla giriş yapabilirsin.'}


@router.post('/login', response_model=TokenResponse | MessageResponse, description='Swagger için username alanına okul e-postanızı yazın. API girişi Bearer token döndürür. Aynı origin web girişi (X-HalicMind-Web: 1) HttpOnly çerez ayarlar ve gövdede yalnızca mesaj döndürür.')
def login(request: Request, response: Response, db: DB, form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    web_session = request.headers.get('X-HalicMind-Web') == '1'
    if web_session:
        validate_web_request(request)
    enforce_limit(db, 'login-ip', client_ip(request), 20, 60)
    enforce_limit(db, 'login-email', form.username.strip().lower(), 10, 300)
    user = auth.authenticate(db, form.username, form.password)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'
    token = create_access_token(user.id, user.session_version)
    if web_session:
        response.set_cookie(
            SESSION_COOKIE, token, max_age=settings.access_token_expire_minutes * 60,
            httponly=True, samesite='lax', secure=bool(settings.public_origin) or request.url.scheme == 'https', path='/api/v1',
        )
        return MessageResponse(message='Oturum açıldı.')
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post('/logout', status_code=204, include_in_schema=False)
def logout(request: Request):
    validate_web_request(request)
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path='/api/v1', httponly=True, samesite='lax')
    response.headers['Cache-Control'] = 'no-store'
    return response
