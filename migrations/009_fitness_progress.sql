ALTER TABLE users ADD COLUMN profile_version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE fitness_metrics (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL, metric TEXT NOT NULL, value REAL NOT NULL,
 context TEXT NOT NULL DEFAULT '', reps INTEGER NOT NULL DEFAULT 0,
 notes TEXT NOT NULL DEFAULT '', goal TEXT NOT NULL,
 idempotency_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,idempotency_key), UNIQUE(user_id,day,metric,context,reps)
);
CREATE INDEX fitness_metrics_owner ON fitness_metrics(user_id,day);
CREATE TABLE fitness_goal_history (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 goal TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
