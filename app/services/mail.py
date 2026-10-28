"""SMTP delivery; local development sends only to the Mailpit inbox."""
from email.message import EmailMessage
import smtplib
import ssl
from typing import Protocol

from app.core.config import settings


class MailDeliveryError(Exception):
    pass


class VerificationMailer(Protocol):
    def send_verification(self, email: str, token: str) -> None: ...


class SMTPMailer:
    def send_verification(self, email: str, token: str) -> None:
        message = EmailMessage()
        message['Subject'] = f'{settings.application_name} — E-posta adresini doğrula'
        message['From'] = f'{settings.application_name} <{settings.smtp_from}>'
        message['To'] = email
        message.set_content(
            f'{settings.application_name} hesabını doğrulamak için aşağıdaki tek kullanımlık kodu kullan:\n\n'
            f'{token}\n\n'
            f'Bu kod {settings.email_verification_expire_minutes} dakika geçerlidir.\n'
            'Kodu uygulamanın e-posta doğrulama alanına gir. '
            'Geliştirme aşamasında Swagger üzerinden POST /api/v1/auth/verify-email '
            'isteğinin token alanında kullanabilirsin.\n\n'
            'Bu kaydı sen başlatmadıysan bu mesajı dikkate alma.\n'
        )
        smtp_class = smtplib.SMTP_SSL if settings.smtp_tls_mode == 'ssl' else smtplib.SMTP
        kwargs = {'timeout': settings.smtp_timeout_seconds}
        if settings.smtp_tls_mode == 'ssl':
            kwargs['context'] = ssl.create_default_context()
        try:
            with smtp_class(settings.smtp_host, settings.smtp_port, **kwargs) as smtp:
                if settings.smtp_tls_mode == 'starttls':
                    smtp.starttls(context=ssl.create_default_context())
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
                smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise MailDeliveryError('Verification message could not be delivered') from exc


def get_mailer() -> VerificationMailer:
    return SMTPMailer()
