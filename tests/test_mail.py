import smtplib

import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.services.mail import MailDeliveryError, SMTPMailer


@pytest.mark.parametrize('mode', ['none', 'starttls', 'ssl'])
def test_smtp_transport_and_verification_message(monkeypatch, mode):
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, **kwargs):
            calls.append(('connect', host, port, kwargs))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def starttls(self, **kwargs):
            assert 'context' in kwargs
            calls.append(('starttls',))

        def login(self, username, password):
            calls.append(('login', username, password))

        def send_message(self, message):
            calls.append(('send', message))

    monkeypatch.setattr(smtplib, 'SMTP_SSL' if mode == 'ssl' else 'SMTP', FakeSMTP)
    monkeypatch.setattr(settings, 'smtp_tls_mode', mode)
    SMTPMailer().send_verification('23000000001@ogr.halic.edu.tr', 'test-verification-code')
    message = calls[-1][1]
    assert message['To'] == '23000000001@ogr.halic.edu.tr'
    assert 'test-verification-code' in message.get_content()
    assert '30 dakika' in message.get_content()
    assert any(call[0] == 'starttls' for call in calls) == (mode == 'starttls')
    assert ('context' in calls[0][3]) == (mode == 'ssl')


def test_smtp_failure_is_wrapped(monkeypatch):
    def fail(*args, **kwargs):
        raise OSError('Test transport failure')

    monkeypatch.setattr(smtplib, 'SMTP', fail)
    with pytest.raises(MailDeliveryError):
        SMTPMailer().send_verification('23000000001@ogr.halic.edu.tr', 'test-code')


def test_remote_smtp_requires_tls_and_jwt_secret_has_minimum_length():
    values = {'database_url': 'postgresql+psycopg://unused', 'jwt_secret_key': 'a' * 64}
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{**values, 'smtp_host': 'smtp.example.com', 'smtp_tls_mode': 'none'})
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{**values, 'jwt_secret_key': 'short'})
    assert Settings(_env_file=None, **{**values, 'smtp_host': 'smtp.example.com', 'smtp_tls_mode': 'starttls'}).smtp_port == 1025
