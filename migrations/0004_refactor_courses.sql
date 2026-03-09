-- Migration: 0004_refactor_courses
-- Restructure course hierarchy: subjects → courses → chapters
-- Remove lessons table; study_records now bind directly to chapters.

-- Drop tables that depend on lessons (reverse FK order)
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS study_records;
DROP TABLE IF EXISTS lessons;
DROP TABLE IF EXISTS chapters;

-- courses: one subject can have multiple volumes (e.g. "四年级(上)")
CREATE TABLE courses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- chapters: belong to a course, not a subject
CREATE TABLE chapters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- study_records: bind to a chapter (one record per user/chapter/day)
CREATE TABLE study_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  study_date TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, chapter_id, study_date)
);

CREATE TABLE tasks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  study_record_id  INTEGER NOT NULL REFERENCES study_records(id) ON DELETE CASCADE,
  task_type        TEXT NOT NULL CHECK (task_type IN ('homework', 'recitation', 'preview', 'review')),
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  completed_at     DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
