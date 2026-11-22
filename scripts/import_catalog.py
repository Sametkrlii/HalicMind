"""Apply the catalog atomically, once; repeated runs verify the recorded checksums."""
import hashlib
from pathlib import Path
import psycopg
from app.core.config import settings

ROOT = Path(__file__).resolve().parents[1]

def main():
    files = [ROOT / 'catalog' / name for name in ('schema.sql', 'research_extension.sql', 'catalog_data_postgresql.sql')]
    migrations = [('001', files), ('002', [ROOT / 'catalog' / '002_university_electives.sql'])]
    with psycopg.connect(settings.database_url.replace('postgresql+psycopg://', 'postgresql://', 1)) as conn:
        conn.execute('SELECT pg_advisory_xact_lock(727401)')
        conn.execute('CREATE TABLE IF NOT EXISTS catalog_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
        for version, paths in migrations:
            raw = b''.join(path.read_bytes() for path in paths)
            canonical = raw.replace(b'\r\n', b'\n')
            digest = hashlib.sha256(canonical).hexdigest()
            row = conn.execute('SELECT checksum FROM catalog_migrations WHERE version=%s', (version,)).fetchone()
            if row:
                # The original importer hashed checkout bytes, including Windows CRLF.
                legacy_crlf = hashlib.sha256(canonical.replace(b'\n', b'\r\n')).hexdigest()
                if row[0] not in {digest, legacy_crlf, hashlib.sha256(raw).hexdigest()}:
                    raise RuntimeError(f'Catalog migration {version} changed after import.')
                continue
            for path in paths:
                sql = '\n'.join(line for line in path.read_text(encoding='utf-8').splitlines() if line.strip().upper() not in ('BEGIN;', 'COMMIT;'))
                conn.execute(sql, prepare=False)
            conn.execute('INSERT INTO catalog_migrations(version,checksum) VALUES (%s,%s)', (version, digest))
    print('Catalog migrations applied and checksums verified.')

if __name__ == '__main__':
    main()
