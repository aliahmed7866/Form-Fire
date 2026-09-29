CREATE TABLE planned_meals (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL, slot TEXT NOT NULL CHECK(slot IN ('breakfast','lunch','dinner','snack')),
 quantity REAL NOT NULL CHECK(quantity>0), snapshot TEXT NOT NULL,
 idempotency_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 diary_entry_id TEXT REFERENCES food_diary(id) ON DELETE SET NULL,
 logged_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX planned_meals_owner_day ON planned_meals(user_id,day);
CREATE TABLE habit_logs (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL, habit TEXT NOT NULL, completed INTEGER NOT NULL CHECK(completed IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(user_id,day,habit)
);
CREATE TABLE planner_shopping (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 week TEXT NOT NULL, food_id TEXT NOT NULL, purchased INTEGER NOT NULL CHECK(purchased IN (0,1)),
 quantity REAL NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(user_id,week,food_id)
);
