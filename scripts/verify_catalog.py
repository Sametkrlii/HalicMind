"""Compare every catalog table against a read-only SQLite source snapshot."""
import argparse
from collections import Counter
from datetime import date
from decimal import Decimal
import json
from pathlib import Path
import sqlite3
import psycopg
from psycopg import sql
from app.core.config import settings

TABLES = ('academic_units', 'programs', 'curricula', 'courses', 'course_revisions', 'elective_groups', 'curriculum_courses', 'prerequisites', 'prerequisite_notes', 'catalog_source_pages', 'catalog_source_rows', 'course_source_details', 'annual_curriculum_courses', 'elective_group_courses')

def normalize(value):
    if isinstance(value, (bool, int, float, Decimal)):
        return Decimal(str(int(value) if isinstance(value, bool) else value)).normalize()
    if isinstance(value, date):
        return value.isoformat()
    return value

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sqlite_source', type=Path)
    args = parser.parse_args()
    counts = {}
    with sqlite3.connect(args.sqlite_source.resolve().as_uri() + '?mode=ro', uri=True) as source, psycopg.connect(settings.database_url.replace('postgresql+psycopg://', 'postgresql://', 1)) as target:
        target.execute('SET TRANSACTION READ ONLY')
        for table in TABLES:
            expected = Counter(tuple(normalize(v) for v in row) for row in source.execute(f'SELECT * FROM {table}'))
            actual = Counter(tuple(normalize(v) for v in row) for row in target.execute(sql.SQL('SELECT * FROM {}').format(sql.Identifier(table))))
            if actual != expected:
                raise RuntimeError(f'Data mismatch in {table}')
            counts[table] = sum(actual.values())
        counts['catalog_courses_readable'] = target.execute('SELECT count(*) FROM catalog_courses_readable').fetchone()[0]
        assert counts['catalog_courses_readable'] == source.execute('SELECT count(*) FROM catalog_courses_readable').fetchone()[0]
    print(json.dumps({'all_table_values_match': True, 'counts': counts}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
