CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('New_Employee', 'Manager')),
  manager_id  TEXT REFERENCES users(id),
  start_date  TEXT NOT NULL,
  is_at_risk  INTEGER NOT NULL DEFAULT 0,
  checkin_interval_days INTEGER NOT NULL DEFAULT 14,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id              TEXT PRIMARY KEY,
  employee_id     TEXT NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'missed')),
  due_at          TEXT NOT NULL,
  completed_at    TEXT,
  sentiment_score REAL,
  struggle_type   TEXT CHECK(struggle_type IN ('HUMAN', 'TECHNICAL', 'BOTH', 'NONE')),
  questions       TEXT NOT NULL,
  responses       TEXT,
  routing         TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS culture_values (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  company_id  TEXT NOT NULL DEFAULT 'default'
);

CREATE TABLE IF NOT EXISTS culture_champions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  culture_value_id TEXT NOT NULL REFERENCES culture_values(id),
  bio              TEXT
);

CREATE TABLE IF NOT EXISTS checkin_notes (
  id          TEXT PRIMARY KEY,
  checkin_id  TEXT NOT NULL REFERENCES checkins(id),
  employee_id TEXT NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manager_notifications (
  id          TEXT PRIMARY KEY,
  manager_id  TEXT NOT NULL REFERENCES users(id),
  employee_id TEXT NOT NULL REFERENCES users(id),
  message     TEXT NOT NULL,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
