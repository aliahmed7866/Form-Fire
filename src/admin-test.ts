import type { DatabaseSync } from 'node:sqlite';
import { id, transaction } from './db.ts';
import { digest, passwordHash, token, totp, totpSecret } from './auth.ts';
import { planSnapshot } from './plan-library.ts';

export const adminTestEmail = 'admin-test@form-fire.example';
const adminMarker = 'local.admin-test.created';
const sampleMarker = 'local-admin-test-v1';
const sampleEmails = ['example-jamie@form-fire.example', 'example-sam@form-fire.example'];

function localTestOnly(mode = process.env.FF_MODE || 'local-test') {
  if (mode !== 'local-test') throw Error('Admin test setup is available only in local-test mode.');
}

function markedAdmin(db: DatabaseSync) {
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(adminTestEmail) as any;
  if (!user || user.role !== 'admin' || !user.totp_secret || !db.prepare('SELECT id FROM audit WHERE action=? AND entity_id=? AND actor_id=?').get(adminMarker, user.id, user.id)) {
    throw Error('The dedicated test administrator has not been created by setup-admin-test. Existing accounts are never repurposed.');
  }
  return user;
}

function untouchedStarter(db: DatabaseSync, templateId: string) {
  const template = db.prepare('SELECT * FROM templates WHERE id=? AND archived=0 AND is_demo=1 AND version=1').get(templateId) as any;
  if (!template) return null;
  try {
    const snapshot = planSnapshot(db, template, 'Fictional example for exploring the admin panel. Tailor a real plan with the client before use.');
    const exercises = snapshot.workouts.flatMap((workout: any) => workout.exercises.map((item: any) => item.exercise));
    if ([...exercises, ...snapshot.recipes].some(item => !item.is_demo || item.version !== 1)) return null;
    return { template, snapshot };
  } catch {
    // An archived/deleted library reference is not a reason to restore it.
    return null;
  }
}

function seedExamples(db: DatabaseSync, adminId: string) {
  if (db.prepare('SELECT id FROM content_packs WHERE id=?').get(sampleMarker)) return { created: false, assignments: 0, skipped: [] as string[] };
  for (const email of sampleEmails) {
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw Error(`Cannot create fictional examples: ${email} already belongs to an existing account. Nothing has been changed.`);
  }
  const clients = [
    { email: sampleEmails[0], name: 'Example · Jamie', active: false },
    { email: sampleEmails[1], name: 'Example · Sam', active: true }
  ];
  let assignments = 0;
  const skipped: string[] = [];
  for (const client of clients) {
    const userId = id(), requestId = id();
    const details = {
      goals: 'Fictional example: make space for enjoyable movement and everyday meals.',
      experience: 'Example intake for testing the request review flow.',
      equipment: 'Example: a stable chair, wall and light dumbbells.',
      availability: 'Example: two flexible sessions each week.',
      preferences: 'Example: practical meals with room for favourite foods.'
    };
    db.prepare("INSERT INTO users(id,email,name,password,role,verified,profile,admin_notes) VALUES(?,?,?,?,'client',1,?,?)").run(userId, client.email, client.name, passwordHash(token()), JSON.stringify({ goals: details.goals, preferences: details.preferences, dietary: 'Fictional example — discuss individual requirements.' }), 'Fictional account created by setup-admin-test. No real person or health outcome is represented.');
    db.prepare("INSERT INTO requests(id,user_id,service_id,kind,details,status,package,active,idempotency_key) VALUES(?,?,'both','coaching',?,?,?,?,?)").run(requestId, userId, JSON.stringify(details), client.active ? 'approved' : 'submitted', client.active ? JSON.stringify({ description: 'Example coaching package · training and good food · no payment recorded' }) : null, client.active ? 1 : 0, id());
    for (const status of client.active ? ['submitted', 'under_review', 'approved'] : ['submitted']) {
      db.prepare('INSERT INTO request_events(id,request_id,actor_id,status) VALUES(?,?,?,?)').run(id(), requestId, status === 'submitted' ? userId : adminId, status);
    }
    if (!client.active) continue;
    for (const templateId of ['starter-training', 'starter-meals']) {
      const starter = untouchedStarter(db, templateId);
      if (!starter) { skipped.push(templateId); continue; }
      const { template, snapshot } = starter;
      db.prepare('INSERT INTO assignments(id,user_id,request_id,template_id,template_version,version,title,kind,snapshot) VALUES(?,?,?,?,?,1,?,?,?)').run(id(), userId, requestId, template.id, template.version, 'Example · ' + template.title, template.kind, JSON.stringify(snapshot));
      assignments++;
    }
    const monday = new Date();
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    db.prepare('INSERT INTO checkins(id,user_id,week,progress,energy,notes,feedback) VALUES(?,?,?,?,3,?,?)').run(id(), userId, monday.toISOString().slice(0, 10), 'Fictional welcome check-in: use this example to try writing a supportive reply.', 'Example note: I would like help finding a comfortable starting point. The energy value is a form example, not a health measurement.', '');
  }
  db.prepare('INSERT INTO content_packs(id) VALUES(?)').run(sampleMarker);
  db.prepare('INSERT INTO audit(id,actor_id,action,entity_id) VALUES(?,?,?,?)').run(id(), adminId, 'local.admin-test.examples-created', sampleMarker);
  return { created: true, assignments, skipped };
}

// Called explicitly by the terminal command. Never imported or run by server startup.
export function setupAdminTest(db: DatabaseSync, mode?: string) {
  localTestOnly(mode);
  return transaction(db, () => {
    let user = db.prepare('SELECT * FROM users WHERE email=?').get(adminTestEmail) as any;
    let password: string | undefined, secret: string | undefined;
    const created = !user;
    if (user) user = markedAdmin(db);
    else {
      password = token().slice(0, 32);
      secret = totpSecret();
      const userId = id();
      db.prepare("INSERT INTO users(id,email,name,password,role,verified,totp_secret) VALUES(?,?,?,?,'admin',1,?)").run(userId, adminTestEmail, 'Alex · test admin', passwordHash(password), secret);
      db.prepare('INSERT INTO audit(id,actor_id,action,entity_id) VALUES(?,?,?,?)').run(id(), userId, adminMarker, userId);
      user = markedAdmin(db);
    }
    const samples = seedExamples(db, user.id);
    return { created, email: adminTestEmail, password, secret, currentOTP: totp(user.totp_secret), samples };
  });
}

export function readAdminTestOTP(db: DatabaseSync, mode?: string) {
  localTestOnly(mode);
  return totp(markedAdmin(db).totp_secret);
}

export function recoverAdminTest(db: DatabaseSync, mode?: string) {
  localTestOnly(mode);
  const user = markedAdmin(db), code = token();
  transaction(db, () => {
    db.prepare("DELETE FROM tokens WHERE user_id=? AND kind='reset'").run(user.id);
    db.prepare("DELETE FROM outbox WHERE user_id=? AND kind='reset'").run(user.id);
    db.prepare("INSERT INTO tokens(id,user_id,kind,expires) VALUES(?,?,'reset',?)").run(digest(code), user.id, Date.now() + 3600000);
    db.prepare("INSERT INTO outbox(id,user_id,kind,token) VALUES(?,?,'reset',?)").run(id(), user.id, code);
    db.prepare('INSERT INTO audit(id,actor_id,action,entity_id) VALUES(?,?,?,?)').run(id(), user.id, 'local.admin-test.recovery-issued', user.id);
  });
  return code;
}
