"""Explicit ownership boundary between Alembic and the SQL catalog importer."""

# Extend deliberately when adding application tables. Catalog tables and
# catalog_migrations belong to scripts.import_catalog, even if models are added.
MANAGED_TABLES = frozenset({'users', 'email_verifications', 'auth_rate_limits', 'academic_profiles', 'academic_terms', 'enrollments', 'assignments', 'exam_documents', 'exam_sync_state', 'exam_selections'})


def include_name(name, type_, parent_names):
    """Avoid reflecting tables outside Alembic's ownership."""
    if type_ == 'table':
        return name in MANAGED_TABLES
    return True


def include_object(object_, name, type_, reflected, compare_to):
    """Also exclude unowned tables introduced into application metadata."""
    if type_ == 'table':
        return name in MANAGED_TABLES
    table = getattr(object_, 'table', None)
    return table is None or table.name in MANAGED_TABLES
