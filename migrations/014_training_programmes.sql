CREATE TABLE programme_sessions (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 programme_id TEXT NOT NULL,
 session_id TEXT NOT NULL,
 day TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('completed','partial','skipped')),
 effort INTEGER CHECK(effort BETWEEN 1 AND 5),
 notes TEXT NOT NULL DEFAULT '',
 snapshot TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,programme_id,session_id,day)
);
CREATE INDEX programme_owner_day ON programme_sessions(user_id,day);
CREATE TABLE programme_template_copies (
 actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 submission_key TEXT NOT NULL,
 programme_id TEXT NOT NULL,
 template_id TEXT NOT NULL REFERENCES templates(id),
 PRIMARY KEY(actor_id,submission_key)
);
