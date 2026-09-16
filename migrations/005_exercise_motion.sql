-- SQLite cannot alter a CHECK constraint. Rebuild only the library table;
-- exercise references live inside JSON, and assigned snapshots remain unchanged.
CREATE TABLE exercises_v4 (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL,
 equipment TEXT NOT NULL DEFAULT '', instructions TEXT NOT NULL,
 video_url TEXT NOT NULL DEFAULT '', video_caption TEXT NOT NULL DEFAULT '',
 animation TEXT NOT NULL DEFAULT '' CHECK(animation IN (
  '', 'wall-push', 'push-up', 'floor-press', 'row', 'band-row', 'reverse-fly',
  'shoulder-press', 'lateral-raise', 'biceps-curl', 'hammer-curl',
  'triceps-extension', 'triceps-kickback', 'dead-bug', 'bird-dog', 'plank',
  'glute-bridge', 'clamshell', 'standing-hip-abduction', 'squat',
  'reverse-lunge', 'hinge', 'romanian-deadlift', 'calf-raise', 'seated-calf-raise'
 )),
 is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0,1)),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO exercises_v4 (id,title,category,equipment,instructions,video_url,video_caption,animation,is_demo,archived,version,updated_at)
 SELECT id,title,category,equipment,instructions,video_url,video_caption,animation,is_demo,archived,version,updated_at FROM exercises;
DROP TABLE exercises;
ALTER TABLE exercises_v4 RENAME TO exercises;
