-- Additive extension: original source labels, annual plans and traceability.
CREATE TABLE IF NOT EXISTS catalog_source_pages (
    program_id BIGINT PRIMARY KEY REFERENCES programs(id) ON DELETE RESTRICT,
    source_url TEXT NOT NULL,
    checked_at DATE NOT NULL,
    source_row_count INTEGER NOT NULL CHECK (source_row_count >= 0),
    period_numbers TEXT NOT NULL,
    coverage_note TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_source_rows (
    program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
    source_line INTEGER NOT NULL,
    period_kind TEXT NOT NULL CHECK (period_kind IN ('year','semester')),
    period_number SMALLINT NOT NULL CHECK (period_number BETWEEN 1 AND 24),
    course_code_original TEXT NOT NULL,
    course_name_original TEXT NOT NULL,
    hours_original TEXT NOT NULL,
    ects_original TEXT NOT NULL,
    course_type_original TEXT NOT NULL,
    row_kind TEXT NOT NULL CHECK (row_kind IN ('course','slot')),
    PRIMARY KEY(program_id,source_line)
);
CREATE TABLE IF NOT EXISTS course_source_details (
    course_revision_id BIGINT PRIMARY KEY REFERENCES course_revisions(id) ON DELETE RESTRICT,
    name_original TEXT NOT NULL,
    hours_original TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS annual_curriculum_courses (
    curriculum_id BIGINT NOT NULL REFERENCES curricula(id) ON DELETE RESTRICT,
    course_revision_id BIGINT NOT NULL REFERENCES course_revisions(id) ON DELETE RESTRICT,
    year_number SMALLINT NOT NULL CHECK (year_number BETWEEN 1 AND 12),
    course_type TEXT NOT NULL CHECK (course_type IN ('required','elective')),
    elective_group_id BIGINT,
    PRIMARY KEY(curriculum_id,year_number,course_revision_id),
    FOREIGN KEY(elective_group_id,curriculum_id) REFERENCES elective_groups(id,curriculum_id) ON DELETE RESTRICT,
    CHECK(elective_group_id IS NULL OR course_type='elective')
);
CREATE INDEX IF NOT EXISTS ix_annual_revision ON annual_curriculum_courses(course_revision_id);
CREATE INDEX IF NOT EXISTS ix_source_rows_code ON catalog_source_rows(course_code_original);
CREATE TABLE IF NOT EXISTS elective_group_courses (
    elective_group_id BIGINT NOT NULL REFERENCES elective_groups(id) ON DELETE RESTRICT,
    course_revision_id BIGINT NOT NULL REFERENCES course_revisions(id) ON DELETE RESTRICT,
    period_number SMALLINT NOT NULL CHECK(period_number BETWEEN 1 AND 24),
    PRIMARY KEY(elective_group_id,course_revision_id,period_number)
);
CREATE OR REPLACE VIEW catalog_courses_readable AS
WITH placements AS (
    SELECT curriculum_id,course_revision_id,semester AS period_number,'semester' AS period_kind,course_type FROM curriculum_courses
    UNION ALL
    SELECT curriculum_id,course_revision_id,year_number,'year',course_type FROM annual_curriculum_courses
)
SELECT p.id AS program_id, cu.id AS curriculum_id, r.id AS course_revision_id, 'Haliç Üniversitesi' AS university, au.name_tr AS faculty,p.name_tr AS department,
       p.degree_level,cu.label AS curriculum,pl.period_kind,pl.period_number,
       CASE WHEN pl.period_kind='semester' THEN pl.period_number ELSE NULL END AS semester,
       CASE WHEN pl.period_kind='year' THEN pl.period_number ELSE NULL END AS year_number,
       c.course_code, d.name_original AS course_name,r.ects,r.local_credit,
       r.language_code,pl.course_type,d.hours_original,r.source_url,
       r.last_verified_at,r.verification_status,cu.coverage_status
FROM placements pl JOIN curricula cu ON cu.id=pl.curriculum_id
JOIN programs p ON p.id=cu.program_id
JOIN academic_units au ON au.id=p.academic_unit_id
JOIN course_revisions r ON r.id=pl.course_revision_id
JOIN courses c ON c.id=r.course_id
JOIN course_source_details d ON d.course_revision_id=r.id;
