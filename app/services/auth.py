from datetime import datetime, timedelta, timezone
import secrets
import logging

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email_policy import normalize_student_email
from app.core.security import DUMMY_PASSWORD_HASH, hash_password, hash_reset_token, hash_verification_token, verify_password
from app.models import EmailVerification, User
from app.schemas.auth import RegisterRequest
from app.services.mail import MailDeliveryError, VerificationMailer


def replace_verification(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    challenge = db.get(EmailVerification, user.id)
    if challenge is None:
        challenge = EmailVerification(user_id=user.id)
        db.add(challenge)
    challenge.token_hash = hash_verification_token(token)
    challenge.created_at = datetime.now(timezone.utc)
    challenge.expires_at = challenge.created_at + timedelta(minutes=settings.email_verification_expire_minutes)
    return token


def deliver_verification(mailer: VerificationMailer, email: str, token: str):
    try:
        mailer.send_verification(email, token)
    except MailDeliveryError:
        # Account remains pending. The resend endpoint can recover delivery.
        raise HTTPException(
            503, 'Doğrulama e-postası gönderilemedi. Bir dakika sonra yeniden gönder isteğini kullanın.',
            headers={'Retry-After': '60'},
        ) from None


def register_user(db: Session, data: RegisterRequest, mailer: VerificationMailer):
    if db.scalar(select(User.id).where(User.email == data.email)) is not None:
        raise HTTPException(409, 'Bu e-posta adresiyle kayıtlı bir hesap var.')
    user = User(email=data.email, full_name=data.full_name, hashed_password=hash_password(data.password.get_secret_value()))
    db.add(user)
    try:
        db.flush()
        token = replace_verification(db, user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if getattr(exc.orig.diag, 'constraint_name', None) == 'uq_users_email':
            raise HTTPException(409, 'Bu e-posta adresiyle kayıtlı bir hesap var.') from None
        raise
    deliver_verification(mailer, data.email, token)


def resend_verification(db: Session, email: str, mailer: VerificationMailer):
    user = db.scalar(select(User).where(User.email == email).with_for_update())
    if user is None or not user.is_active or user.email_verified_at is not None:
        db.rollback()
        return
    token = replace_verification(db, user)
    db.commit()
    deliver_verification(mailer, email, token)


def verify_email(db: Session, token: str):
    token_hash = hash_verification_token(token)
    user_id = db.scalar(select(EmailVerification.user_id).where(EmailVerification.token_hash == token_hash))
    if user_id is None:
        raise HTTPException(400, 'Doğrulama kodu geçersiz veya süresi dolmuş.')
    # Serialize against resend and other verification attempts for this user.
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    challenge = db.scalar(select(EmailVerification).where(
        EmailVerification.user_id == user_id, EmailVerification.token_hash == token_hash,
    ).execution_options(populate_existing=True))
    now = datetime.now(timezone.utc)
    if (
        user is None or not user.is_active or user.email_verified_at is not None
        or challenge is None or challenge.expires_at <= now
    ):
        raise HTTPException(400, 'Doğrulama kodu geçersiz veya süresi dolmuş.')
    user.email_verified_at = now
    db.delete(challenge)
    db.commit()


def authenticate(db: Session, email: str, password: str) -> User:
    try:
        email = normalize_student_email(email)
    except ValueError:
        email = ''
    user = db.scalar(select(User).where(User.email == email))
    candidate = password if len(password) <= 128 else ''
    valid = verify_password(candidate, user.hashed_password if user else DUMMY_PASSWORD_HASH)
    if user is None or not valid or not user.is_active:
        raise HTTPException(401, 'E-posta veya parola hatalı.', headers={'WWW-Authenticate': 'Bearer'})
    if user.email_verified_at is None:
        raise HTTPException(403, 'Giriş yapmadan önce e-posta adresinizi doğrulayın.')
    return user


def issue_reset_code(db: Session, email: str) -> str | None:
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)).with_for_update())
    if user is None:
        db.rollback()
        return None
    token = secrets.token_urlsafe(32)
    user.reset_token_hash = hash_reset_token(token)
    user.reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_expire_minutes)
    db.commit()
    return token


def deliver_reset_code(mailer: VerificationMailer, email: str, token: str):
    try:
        mailer.send_password_reset(email, token)
    except MailDeliveryError:
        logging.getLogger(__name__).warning('Password reset email delivery failed')


def reset_password(db: Session, token: str, password: str):
    user = db.scalar(select(User).where(
        User.reset_token_hash == hash_reset_token(token), User.is_active.is_(True),
    ).with_for_update())
    if user is None or user.reset_expires_at is None or user.reset_expires_at <= datetime.now(timezone.utc):
        raise HTTPException(400, 'Sıfırlama kodu geçersiz veya süresi dolmuş. Yeni kod iste.')
    if verify_password(password, user.hashed_password):
        raise HTTPException(422, 'Yeni parola önceki parolandan farklı olmalı.')
    user.hashed_password = hash_password(password)
    user.reset_token_hash = None
    user.reset_expires_at = None
    user.session_version += 1
    db.commit()
