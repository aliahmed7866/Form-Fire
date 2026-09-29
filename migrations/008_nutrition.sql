ALTER TABLE recipes ADD COLUMN ingredient_items TEXT NOT NULL DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN yield_servings REAL NOT NULL DEFAULT 1 CHECK(yield_servings>0);
ALTER TABLE recipes ADD COLUMN nutrition TEXT;
ALTER TABLE recipes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN prep_minutes INTEGER NOT NULL DEFAULT 20;
ALTER TABLE recipes ADD COLUMN client_id TEXT REFERENCES users(id);
CREATE TABLE food_diary (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL, slot TEXT NOT NULL CHECK(slot IN ('breakfast','lunch','dinner','snack')),
 quantity REAL NOT NULL CHECK(quantity>0), snapshot TEXT NOT NULL,
 idempotency_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,idempotency_key)
);
CREATE INDEX food_diary_owner_day ON food_diary(user_id,day);
CREATE TABLE recipe_favourites (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipe_id TEXT NOT NULL REFERENCES recipes(id), PRIMARY KEY(user_id,recipe_id)
);
CREATE TABLE nutrition_targets (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 targets TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
