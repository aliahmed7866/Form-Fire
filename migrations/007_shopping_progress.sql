CREATE TABLE shopping_progress (
 assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purchased TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(purchased)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX shopping_progress_owner ON shopping_progress(user_id);
