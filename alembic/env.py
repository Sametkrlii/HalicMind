"""Run application migrations alongside the separately imported catalog."""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import settings
from app.db.base import Base
from app.db.migrations import include_name, include_object
from app import models  # noqa: F401 -- register all mapped application tables

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def configure(**kwargs):
    context.configure(
        target_metadata=target_metadata,
        include_schemas=False,
        include_name=include_name,
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
        **kwargs,
    )


def run_migrations_offline():
    configure(
        url=settings.database_url,
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
    )
    with context.begin_transaction():
        context.run_migrations()


def migrate_connection(connection):
    configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    # Tests / programmatic callers can supply an already transactional connection.
    connection = config.attributes.get('connection')
    if connection is not None:
        migrate_connection(connection)
        return

    engine = create_engine(
        settings.database_url,
        poolclass=pool.NullPool,
        connect_args={'connect_timeout': 5},
    )
    try:
        with engine.connect() as connection:
            migrate_connection(connection)
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
