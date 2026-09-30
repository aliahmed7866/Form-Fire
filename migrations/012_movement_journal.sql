CREATE TABLE movement_entries (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 title TEXT NOT NULL,
 minutes INTEGER NOT NULL CHECK(minutes BETWEEN 1 AND 1440),
 intensity TEXT NOT NULL CHECK(intensity IN ('gentle','moderate','vigorous','strength')),
 notes TEXT NOT NULL DEFAULT '',
 idempotency_key TEXT NOT NULL,
 original_payload TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 deleted_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX movement_owner_day ON movement_entries(user_id,day);
