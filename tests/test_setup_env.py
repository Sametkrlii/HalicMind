import os
import pytest
from dotenv import dotenv_values
from sqlalchemy.engine import make_url
from scripts.setup_env import create_env


def test_generated_credentials_match_and_are_unique(tmp_path):
    first = tmp_path / '.env'
    second = tmp_path / '.env.second'
    create_env(first)
    create_env(second)
    values = dotenv_values(first)
    url = make_url(values['DATABASE_URL'])
    assert url.password == values['POSTGRES_PASSWORD']
    assert len(url.password) == 48
    assert url.host == '127.0.0.1' and url.port == 5433
    assert values['POSTGRES_PASSWORD'] != dotenv_values(second)['POSTGRES_PASSWORD']
    if os.name == 'posix':
        assert first.stat().st_mode & 0o777 == 0o600


def test_existing_configuration_is_preserved(tmp_path):
    path = tmp_path / '.env'
    path.write_text('DATABASE_URL=existing\n')
    with pytest.raises(FileExistsError):
        create_env(path)
    assert path.read_text() == 'DATABASE_URL=existing\n'
