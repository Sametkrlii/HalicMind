-- Modern Diller shared electives, official Turkish course plan checked 2026-11-20.
CREATE TABLE university_electives (
    course_revision_id bigint PRIMARY KEY REFERENCES course_revisions(id) ON DELETE RESTRICT
);

WITH source(code, name, ects) AS (VALUES
    ('HLU0001', 'Creative Writing I', 3),
    ('HLU0050', 'Professional English', 4),
    ('HLU0101', 'Professional English I', 3),
    ('HLU0105', 'English for Academic Purposes I', 3),
    ('HLU0501', 'German I', 3),
    ('HLU0511', 'Arabic I', 3),
    ('HLU0521', 'French I', 3),
    ('HLU0531', 'Russian I', 3),
    ('HLU0541', 'Spanish I', 3),
    ('HLU0551', 'Italian I', 3),
    ('HLU0561', 'Persian I', 3),
    ('HLU0571', 'World Mythologies and Cultural Narratives', 3),
    ('HLU0573', 'Fantasy Fiction', 3),
    ('HLU0575', 'Graphic Novels and Visual Narratives', 3),
    ('HLU0577', 'World-Building and Narrative Design: How Stories Construct Reality', 3),
    ('HLU0579', 'Dystopian Literature', 3),
    ('HLÜ0001', 'Yaratıcı Yazarlık I', 3),
    ('HLÜ0101', 'Mesleki İngilizce I', 3),
    ('HLÜ0111', 'İleri Mesleki İngilizce I', 4),
    ('HLU0002', 'Creative Writing II', 3),
    ('HLU0102', 'Professional English II', 3),
    ('HLU0106', 'English for Academic Purposes II', 3),
    ('HLU0502', 'German II', 3),
    ('HLU0512', 'Arabic II', 3),
    ('HLU0522', 'French II', 3),
    ('HLU0532', 'Russian II', 3),
    ('HLU0542', 'Spanish II', 3),
    ('HLU0552', 'Italian II', 3),
    ('HLU0562', 'Persian II', 3),
    ('HLÜ0002', 'Yaratıcı Yazarlık II', 3),
    ('HLÜ0102', 'Mesleki İngilizce II', 3),
    ('HLÜ0112', 'İleri Mesleki İngilizce II', 4),
    ('HLU0103', 'Professional English III', 3),
    ('HLU0107', 'English for Academic Purposes III', 3),
    ('HLU0523', 'French III', 3),
    ('HLU0543', 'Spanish III', 3),
    ('HLU0553', 'Italian III', 3),
    ('HLÜ0103', 'Mesleki İngilizce III', 3),
    ('HLÜ0113', 'İleri Mesleki İngilizce III', 4),
    ('HLU0104', 'Professional English IV', 3),
    ('HLU0108', 'English for Academic Purposes IV', 3),
    ('HLU0524', 'French IV', 3),
    ('HLU0554', 'Italian IV', 3),
    ('HLÜ0104', 'Mesleki İngilizce IV', 3),
    ('HLÜ0114', 'İleri Mesleki İngilizce IV', 4),
    ('HLÜ0115', 'İleri Mesleki İngilizce V', 4),
    ('HLÜ0116', 'İleri Mesleki İngilizce VI', 4)
), added_courses AS (
    INSERT INTO courses (source_key, course_code)
    SELECT 'modern-diller:' || code, code FROM source
    RETURNING id, course_code
), added_revisions AS (
    INSERT INTO course_revisions (course_id, revision_key, name_tr, ects, source_url, last_verified_at, verification_status)
    SELECT c.id, '2026-11-20', s.name, s.ects,
           'https://halic.edu.tr/tr/akademik/yuksekokullar/yabanci-diller-yuksekokulu/bolumler/modern-diller', DATE '2026-11-20', 'verified'
    FROM added_courses c JOIN source s ON s.code=c.course_code
    RETURNING id
)
INSERT INTO university_electives SELECT id FROM added_revisions;

-- A matching local placement keeps its existing identity, course type and history.
CREATE VIEW available_university_electives AS
WITH local_revisions AS (
    SELECT curriculum_id, course_revision_id FROM curriculum_courses
    UNION ALL SELECT curriculum_id, course_revision_id FROM annual_curriculum_courses
    UNION ALL SELECT g.curriculum_id, m.course_revision_id
              FROM elective_group_courses m JOIN elective_groups g ON g.id=m.elective_group_id
)
SELECT cu.id AS curriculum_id, ue.course_revision_id
FROM curricula cu JOIN programs p ON p.id=cu.program_id
CROSS JOIN university_electives ue
JOIN course_revisions r ON r.id=ue.course_revision_id
JOIN courses c ON c.id=r.course_id AND c.is_active
WHERE p.degree_level IN ('associate','bachelor')
AND NOT EXISTS (
    SELECT 1 FROM local_revisions lr
    JOIN course_revisions v ON v.id=lr.course_revision_id
    JOIN courses local ON local.id=v.course_id
    LEFT JOIN course_source_details d ON d.course_revision_id=v.id
    WHERE lr.curriculum_id=cu.id AND local.course_code=c.course_code
      AND lower(coalesce(d.name_original,v.name_tr,v.name_en))=lower(r.name_tr)
      AND v.ects IS NOT DISTINCT FROM r.ects
);
