CREATE TABLE recipe_adaptations (
 recipe_id TEXT PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_recipe_id TEXT NOT NULL REFERENCES recipes(id), source_version INTEGER NOT NULL,
 style TEXT NOT NULL, protein TEXT NOT NULL, request TEXT NOT NULL,
 idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,idempotency_key)
);
CREATE TABLE catering_batches (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request TEXT NOT NULL, plan_ids TEXT NOT NULL, idempotency_key TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,idempotency_key)
);
