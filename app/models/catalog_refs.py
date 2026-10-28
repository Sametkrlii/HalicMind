"""FK targets only: these catalog tables remain owned by the SQL importer.

These minimal declarations must never be used to create/update catalog tables.
Alembic's explicit ownership filters exclude them from autogeneration.
"""
from sqlalchemy import BigInteger, Column, Table

from app.db.base import Base

for name in ('programs', 'curricula', 'courses', 'course_revisions'):
    Table(name, Base.metadata, Column('id', BigInteger, primary_key=True))
