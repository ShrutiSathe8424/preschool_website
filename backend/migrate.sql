-- Upgrade an existing preschool_db created by the earlier version of Sprout.
-- SQLAlchemy's create_all() adds new TABLES but never new COLUMNS, so run this
-- once against your existing database:
--     mysql -u root -p preschool_db < migrate.sql
-- On a brand new database you can skip this file entirely.

ALTER TABLE admins
  ADD COLUMN phone VARCHAR(20) NULL,
  ADD COLUMN profile_photo VARCHAR(255) NULL;

ALTER TABLE teachers
  ADD COLUMN employee_id VARCHAR(30) NULL UNIQUE,
  ADD COLUMN address VARCHAR(255) NULL,
  ADD COLUMN profile_photo VARCHAR(255) NULL;

ALTER TABLE parents
  ADD COLUMN profile_photo VARCHAR(255) NULL,
  ADD COLUMN father_name VARCHAR(100) NULL,
  ADD COLUMN father_phone VARCHAR(20) NULL,
  ADD COLUMN mother_name VARCHAR(100) NULL,
  ADD COLUMN mother_phone VARCHAR(20) NULL;

ALTER TABLE students
  ADD COLUMN roll_no VARCHAR(30) NULL UNIQUE;

ALTER TABLE attendance
  ADD COLUMN note VARCHAR(255) NULL,
  ADD COLUMN updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- One register row per child per day. Remove duplicates first if this fails.
ALTER TABLE attendance
  ADD CONSTRAINT uq_student_day UNIQUE (student_id, att_date);

ALTER TABLE homework
  MODIFY COLUMN file_url VARCHAR(255) NULL;

ALTER TABLE fees
  ADD COLUMN title VARCHAR(150) NULL DEFAULT 'Term fee',
  ADD COLUMN paid_via VARCHAR(30) NULL,
  ADD COLUMN payment_ref VARCHAR(100) NULL;

ALTER TABLE events
  ADD COLUMN venue VARCHAR(150) NULL,
  ADD COLUMN photo_url VARCHAR(255) NULL;

-- Back-fill roll numbers for students enrolled before this upgrade.
-- (Re-run backend/seed_admin.py, which fills any that are still NULL.)
