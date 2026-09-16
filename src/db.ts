import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { installStarterContent } from './starter-content.ts';
export const id = () => randomUUID();
export function openDb(dir: string) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir,0o700);
  const path = resolve(dir, 'form-fire.sqlite');
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  for(const suffix of ['-wal','-shm'])if(existsSync(path+suffix))chmodSync(path+suffix,0o600);
  db.exec('CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)');
  for (const [version, file] of [[1, '001_initial.sql'], [2, '002_plan_library.sql'], [3, '003_plan_activity.sql'], [4, '004_google_auth.sql'], [5, '005_exercise_motion.sql'], [6, '006_exercise_expansion.sql']] as const) {
    if (db.prepare('SELECT version FROM migrations WHERE version=?').get(version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
      db.prepare('INSERT INTO migrations VALUES(?)').run(version);
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  if ((process.env.FF_MODE || 'local-test') === 'local-test') installStarterContent(db);
  // Confirmed service categories; no fabricated prices or client/financial seed data.
  const services = [
    ['train','Online personal training','train','Build strength at your pace, with support that fits your life.','Online coaching · A programme built around you · Weekly check-ins'],
    ['eat','Chef-created meal plans','eat','Good food belongs in the plan. Let’s make room for meals you look forward to.','Food preferences first · Practical preparation · Shopping lists'],
    ['both','Training + good food','both','Bring training and food together with one supportive coach and chef.','Online coaching · Chef-created meal planning · Weekly check-ins'],
    ['chef','Private chef experiences','chef','Something worth gathering round. Tell me about your occasion.','A menu shaped around your event · Location and travel agreed by enquiry']
  ];
  for (const s of services) db.prepare('INSERT OR IGNORE INTO services(id,title,kind,description,inclusions) VALUES(?,?,?,?,?)').run(...s);
  return db;
}
export function transaction(db: DatabaseSync, fn: () => any) { db.exec('BEGIN IMMEDIATE'); try { const r=fn(); db.exec('COMMIT'); return r; } catch(e) { db.exec('ROLLBACK'); throw e; } }
