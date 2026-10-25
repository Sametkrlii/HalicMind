"""Apply the catalog atomically, once; repeated runs verify the recorded checksums."""
import hashlib
from pathlib import Path
import psycopg
from app.core.config import settings

ROOT = Path(__file__).resolve().parents[1]

def main():
    files = [ROOT / 'catalog' / name for name in ('schema.sql', 'research_extension.sql', 'catalog_data_postgresql.sql')]
    digest = hashlib.sha256(b''.join(p.read_bytes() for p in files)).hexdigest()
    with psycopg.connect(settings.database_url.replace('postgresql+psycopg://', 'postgresql://', 1)) as conn:
        conn.execute('SELECT pg_advisory_xact_lock(727401)')
        conn.execute('CREATE TABLE IF NOT EXISTS catalog_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
        row = conn.execute("SELECT checksum FROM catalog_migrations WHERE version='001'").fetchone()
        if row:
            if row[0] != digest:
                raise RuntimeError('Catalog files changed: create a new migration rather than overwrite existing data.')
            print('Catalog already imported; checksum verified.')
            return
        for path in files:
            sql = '\n'.join(line for line in path.read_text().splitlines() if line.strip().upper() not in ('BEGIN;', 'COMMIT;'))
            conn.execute(sql, prepare=False)
        conn.execute("INSERT INTO catalog_migrations(version,checksum) VALUES ('001',%s)", (digest,))
    print('Catalog imported successfully.')

if __name__ == '__main__':
    main()
