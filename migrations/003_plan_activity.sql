CREATE TABLE plan_activity (
 assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 item_kind TEXT NOT NULL CHECK(item_kind IN ('workout','meal')),
 item_index INTEGER NOT NULL CHECK(item_index >= 0),
 activity_date TEXT NOT NULL,
 timezone TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 2000),
 effort INTEGER CHECK(effort IS NULL OR (item_kind = 'workout' AND effort BETWEEN 1 AND 5)),
 completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(assignment_id,item_kind,item_index,activity_date)
);
CREATE INDEX plan_activity_owner_date ON plan_activity(user_id,activity_date);
CREATE INDEX plan_activity_date ON plan_activity(activity_date);
