from io import BytesIO
import json
from urllib.error import HTTPError

import pytest
from fastapi import HTTPException, Request
from pydantic import SecretStr, ValidationError

from app.core.config import Settings, settings
from app.core.web_security import validate_web_request
from app.services.mail import MailDeliveryError, ResendMailer


def test_public_origin_preserves_csrf_validation_behind_pages(monkeypatch):
    monkeypatch.setattr(settings, 'public_origin', 'https://halicmind.pages.dev')
    def request(origin):
        return Request({'type': 'http', 'method': 'POST', 'path': '/', 'scheme': 'http',
                        'server': ('backend', 8000), 'headers': [
                            (b'x-halicmind-web', b'1'), (b'origin', origin.encode())]})
    validate_web_request(request('https://halicmind.pages.dev'))
    with pytest.raises(HTTPException):
        validate_web_request(request('https://attacker.example'))


def test_resend_delivery_and_failure_do_not_expose_provider_body(monkeypatch):
    monkeypatch.setattr(settings, 'resend_api_key', SecretStr('test-key'))
    monkeypatch.setattr(settings, 'mail_from', 'HalicMind <mail@example.com>')
    calls = []
    class Reply(BytesIO):
        status = 200
    def send(request, **kwargs):
        calls.append(request)
        return Reply(b'{"id":"sent"}')
    monkeypatch.setattr('app.services.mail.urlopen', send)
    ResendMailer().send_verification('student@ogr.halic.edu.tr', 'verification-token')
    payload = json.loads(calls[0].data)
    assert payload['to'] == ['student@ogr.halic.edu.tr']
    assert 'verification-token' in payload['text']
    assert calls[0].get_header('Authorization') == 'Bearer test-key'
    def fail(*args, **kwargs):
        raise HTTPError('https://api.resend.com/emails', 403, 'private detail', {}, None)
    monkeypatch.setattr('app.services.mail.urlopen', fail)
    with pytest.raises(MailDeliveryError, match='Email could not be delivered'):
        ResendMailer().send_password_reset('student@ogr.halic.edu.tr', 'reset-token')


def test_resend_configuration_requires_credentials():
    values = dict(_env_file=None, database_url='postgresql://unused', jwt_secret_key='a' * 64)
    with pytest.raises(ValidationError):
        Settings(**values, mail_provider='resend')
    config = Settings(**values, public_origin='https://halicmind.pages.dev/')
    assert config.public_origin == 'https://halicmind.pages.dev'
    assert config.database_url == 'postgresql+psycopg://unused'


def test_supabase_schema_is_private_and_preserves_ssl_options():
    from sqlalchemy.engine import make_url
    config = Settings(_env_file=None, database_url='postgresql://user:password@host/db?sslmode=require',
                      jwt_secret_key='a' * 64, database_schema='halicmind')
    url = make_url(config.database_url)
    assert url.query['sslmode'] == 'require'
    assert url.query['options'] == '-csearch_path=halicmind'
    assert url.password == 'password'
