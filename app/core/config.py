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
    jwt_secret_key: SecretStr = Field(min_length=32)
    access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)
    email_verification_expire_minutes: int = Field(default=30, ge=1, le=1440)
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
        if self.smtp_host not in {'127.0.0.1', 'localhost', '::1', 'mailpit'} and self.smtp_tls_mode == 'none':
            raise ValueError('Remote SMTP requires starttls or ssl')
        if self.smtp_username and not self.smtp_password:
            raise ValueError('SMTP_PASSWORD is required when SMTP_USERNAME is set')
        return self


settings = Settings()
