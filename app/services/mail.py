"""SMTP delivery; local development sends only to the Mailpit inbox."""
from email.message import EmailMessage
import smtplib
import ssl
import json
from urllib.request import Request, urlopen
from urllib.error import URLError
from typing import Protocol

from app.core.config import settings


class MailDeliveryError(Exception):
    pass


class VerificationMailer(Protocol):
    def send_verification(self, email: str, token: str) -> None: ...
    def send_password_reset(self, email: str, token: str) -> None: ...


class SMTPMailer:
    def send_verification(self, email: str, token: str) -> None:
        self._send(email, 'E-posta adresini doğrula',
            f'{settings.application_name} hesabını doğrulamak için aşağıdaki tek kullanımlık kodu kullan:\n\n'
            f'{token}\n\nBu kod {settings.email_verification_expire_minutes} dakika geçerlidir.\n'
            'Kodu uygulamanın e-posta doğrulama alanına gir. '
            'Geliştirme aşamasında Swagger üzerinden POST /api/v1/auth/verify-email '
            'isteğinin token alanında kullanabilirsin.\n\n'
            'Bu kaydı sen başlatmadıysan bu mesajı dikkate alma.')

    def send_password_reset(self, email: str, token: str) -> None:
        self._send(email, 'Parola sıfırlama kodu',
            f'Parolamı unuttum ekranına aşağıdaki tek kullanımlık kodu gir:\n\n{token}\n\n'
            f'Kod {settings.password_reset_expire_minutes} dakika geçerlidir. '
            'Bu isteği sen başlatmadıysan mesajı dikkate alma.')

    def _send(self, email: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message['Subject'] = f'{settings.application_name} — {subject}'
        message['From'] = f'{settings.application_name} <{settings.smtp_from}>'
        message['To'] = email
        message.set_content(body)
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


class ResendMailer(SMTPMailer):
    """Use HTTPS instead of SMTP on hosts that block mail ports."""

    def _send(self, email: str, subject: str, body: str) -> None:
        request = Request('https://api.resend.com/emails', method='POST',
            headers={'Authorization': f'Bearer {settings.resend_api_key.get_secret_value()}',
                     'Content-Type': 'application/json', 'User-Agent': 'HalicMind/0.2'},
            data=json.dumps({'from': settings.mail_from, 'to': [email],
                             'subject': f'{settings.application_name} — {subject}',
                             'text': body}).encode('utf-8'))
        try:
            with urlopen(request, timeout=settings.smtp_timeout_seconds) as response:
                if response.status != 200:
                    raise MailDeliveryError('Email provider rejected the message')
        except (OSError, URLError) as exc:
            raise MailDeliveryError('Email could not be delivered') from exc


def get_mailer() -> VerificationMailer:
    return ResendMailer() if settings.mail_provider == 'resend' else SMTPMailer()
