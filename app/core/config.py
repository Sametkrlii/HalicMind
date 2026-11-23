from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    application_name: str = Field(default='HalicMind', min_length=1, max_length=80)
    data_controller_name: str | None = Field(default=None, max_length=200)
    privacy_contact_email: str | None = Field(default=None, max_length=254)
    exam_sync_enabled: bool = True
    exam_sync_interval_seconds: int = Field(default=3600, ge=300, le=86400)
    exam_sync_ca_bundle: str | None = None
    database_url: str
    database_schema: str | None = Field(default=None, pattern=r'^[a-z][a-z0-9_]{0,62}$')
    public_origin: str | None = None
    mail_provider: Literal['smtp', 'resend'] = 'smtp'
    resend_api_key: SecretStr | None = None
    mail_from: str | None = None
    jwt_secret_key: SecretStr = Field(min_length=32)
    access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)
    email_verification_expire_minutes: int = Field(default=30, ge=1, le=1440)
    password_reset_expire_minutes: int = Field(default=15, ge=1, le=1440)
    smtp_host: str = '127.0.0.1'
    smtp_port: int = Field(default=1025, ge=1, le=65535)
    smtp_tls_mode: Literal['none', 'starttls', 'ssl'] = 'none'
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_from: str = 'noreply@halicmind.local'
    smtp_timeout_seconds: int = Field(default=10, ge=1, le=60)
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[2] / '.env', extra='ignore')

    @model_validator(mode='after')
    def validate_smtp(self):
        if self.public_origin:
            from urllib.parse import urlsplit
            origin = urlsplit(self.public_origin)
            if origin.scheme != 'https' or not origin.netloc or origin.path not in {'', '/'} or origin.query or origin.fragment or origin.username:
                raise ValueError('PUBLIC_ORIGIN must be an HTTPS origin')
            self.public_origin = self.public_origin.rstrip('/')
        if self.database_url.startswith('postgresql://'):
            self.database_url = self.database_url.replace('postgresql://', 'postgresql+psycopg://', 1)
        if self.database_schema:
            from sqlalchemy.engine import make_url
            url = make_url(self.database_url)
            options = url.query.get('options', '')
            url = url.update_query_dict({'options': f'{options} -csearch_path={self.database_schema}'.strip()})
            self.database_url = url.render_as_string(hide_password=False)
        if self.mail_provider == 'resend' and (not self.resend_api_key or not self.mail_from):
            raise ValueError('Resend requires RESEND_API_KEY and MAIL_FROM')
        if self.smtp_host not in {'127.0.0.1', 'localhost', '::1', 'mailpit'} and self.smtp_tls_mode == 'none':
            raise ValueError('Remote SMTP requires starttls or ssl')
        if self.smtp_username and not self.smtp_password:
            raise ValueError('SMTP_PASSWORD is required when SMTP_USERNAME is set')
        return self


settings = Settings()
