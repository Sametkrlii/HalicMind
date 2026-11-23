"""Initialize a deployment's database, then launch the HTTP server."""
import os
import subprocess
import sys


def main():
    import psycopg
    from psycopg import sql
    from app.core.config import settings
    if settings.database_schema:
        with psycopg.connect(settings.database_url.replace('postgresql+psycopg://', 'postgresql://', 1)) as connection:
            connection.execute(sql.SQL('CREATE SCHEMA IF NOT EXISTS {}').format(sql.Identifier(settings.database_schema)))
            # Keep application tables outside Supabase's default exposed public schema.
            connection.execute(sql.SQL('REVOKE ALL ON SCHEMA {} FROM PUBLIC').format(sql.Identifier(settings.database_schema)))
    subprocess.run([sys.executable, '-m', 'scripts.import_catalog'], check=True)
    subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], check=True)
    os.execv(sys.executable, [sys.executable, '-m', 'uvicorn', 'app.main:app',
                            '--host', '0.0.0.0', '--port', os.environ.get('PORT', '8000')])


if __name__ == '__main__':
    main()
