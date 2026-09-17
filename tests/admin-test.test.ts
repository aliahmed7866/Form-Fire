import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDb, id } from '../src/db.ts';
import { passwordOK, digest, totpOK } from '../src/auth.ts';
import { adminTestEmail, setupAdminTest, readAdminTestOTP, recoverAdminTest } from '../src/admin-test.ts';
import { createApp } from '../src/server.ts';

function temporaryDb() {
  const dir = mkdtempSync(join(tmpdir(), 'ff-admin-test-'));
  const db = openDb(dir);
  return { dir, db, close() { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}
const count = (db: any, table: string) => (db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as any).n;

test('Explicit setup creates a unique, hashed, TOTP-protected admin and clearly fictional examples', () => {
  const one = temporaryDb(), two = temporaryDb();
  try {
    assert.equal(count(one.db, 'users'), 0, 'opening the app never creates test users');
    const result = setupAdminTest(one.db), other = setupAdminTest(two.db);
    assert.equal(result.created, true);
    assert.equal(result.email, adminTestEmail);
    assert.match(result.password!, /^[a-f0-9]{32}$/);
    assert.notEqual(result.password, other.password);
    assert.notEqual(result.secret, other.secret);
    const admin = one.db.prepare('SELECT * FROM users WHERE email=?').get(adminTestEmail) as any;
    assert.equal(admin.role, 'admin');
    assert.equal(admin.verified, 1);
    assert.notEqual(admin.password, result.password);
    assert.equal(passwordOK(result.password!, admin.password), true);
    assert.equal(totpOK(admin.totp_secret, result.currentOTP), true);
    assert.equal(count(one.db, 'users'), 3);
    const clients = one.db.prepare("SELECT name,admin_notes FROM users WHERE role='client'").all() as any[];
    assert.equal(clients.every(client => client.name.startsWith('Example · ') && client.admin_notes.includes('Fictional account')), true);
    assert.equal(count(one.db, 'requests'), 2);
    assert.equal((one.db.prepare('SELECT COUNT(*) n FROM requests WHERE active=1').get() as any).n, 1);
    assert.equal(count(one.db, 'assignments'), 2);
    const plans = one.db.prepare('SELECT title,snapshot FROM assignments').all() as any[];
    assert.equal(plans.every(plan => plan.title.startsWith('Example · ') && JSON.parse(plan.snapshot).is_demo), true);
    assert.equal(count(one.db, 'checkins'), 1);
    for (const table of ['invoices', 'payments', 'plan_activity']) assert.equal(count(one.db, table), 0);
  } finally { one.close(); two.close(); }
});

test('Repeating setup preserves credentials, all edits, and deleted examples across reopening', () => {
  const fixture = temporaryDb();
  try {
    const initial = setupAdminTest(fixture.db);
    const adminBefore = fixture.db.prepare('SELECT * FROM users WHERE email=?').get(adminTestEmail);
    fixture.db.prepare("UPDATE users SET name='Example · Sam edited' WHERE email='example-sam@form-fire.example'").run();
    fixture.db.prepare("UPDATE checkins SET feedback='Your own test reply'").run();
    fixture.db.prepare("UPDATE templates SET title='My edited example',version=version+1 WHERE id='starter-training'").run();
    fixture.db.prepare('DELETE FROM assignments').run();
    const again = setupAdminTest(fixture.db);
    assert.equal(again.created, false);
    assert.equal(again.password, undefined);
    assert.equal(again.secret, undefined);
    assert.equal(again.samples.created, false);
    assert.deepEqual(fixture.db.prepare('SELECT * FROM users WHERE email=?').get(adminTestEmail), adminBefore);
    assert.equal(count(fixture.db, 'assignments'), 0);
    assert.equal((fixture.db.prepare('SELECT feedback FROM checkins').get() as any).feedback, 'Your own test reply');
    fixture.db.close();
    fixture.db = openDb(fixture.dir);
    const reopened = setupAdminTest(fixture.db);
    assert.equal(reopened.samples.created, false);
    assert.equal(count(fixture.db, 'assignments'), 0);
    assert.equal((fixture.db.prepare("SELECT name FROM users WHERE email='example-sam@form-fire.example'").get() as any).name, 'Example · Sam edited');
    assert.equal(passwordOK(initial.password!, (fixture.db.prepare('SELECT password FROM users WHERE email=?').get(adminTestEmail) as any).password), true);
  } finally { fixture.db.close(); rmSync(fixture.dir, { recursive: true, force: true }); }
});

test('Setup refuses existing reserved accounts without markers and rolls back sample collisions', () => {
  for (const role of ['client', 'admin']) {
    const fixture = temporaryDb();
    try {
      fixture.db.prepare('INSERT INTO users(id,email,name,password,role,totp_secret) VALUES(?,?,?,?,?,?)').run(id(), adminTestEmail, 'Existing person', 'unchanged', role, 'UNCHANGED');
      const before = fixture.db.prepare('SELECT * FROM users').all();
      assert.throws(() => setupAdminTest(fixture.db), /never repurposed/);
      assert.throws(() => readAdminTestOTP(fixture.db), /never repurposed/);
      assert.throws(() => recoverAdminTest(fixture.db), /never repurposed/);
      assert.deepEqual(fixture.db.prepare('SELECT * FROM users').all(), before);
      assert.equal(count(fixture.db, 'requests'), 0);
    } finally { fixture.close(); }
  }
  const fixture = temporaryDb();
  try {
    fixture.db.prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)').run(id(), 'example-sam@form-fire.example', 'Existing Sam', 'unchanged');
    assert.throws(() => setupAdminTest(fixture.db), /already belongs/);
    assert.equal(count(fixture.db, 'users'), 1);
    assert.equal(count(fixture.db, 'requests'), 0);
    assert.equal(count(fixture.db, 'audit'), 0);
  } finally { fixture.close(); }
});

test('Test tooling is local-only and does not resurrect edited or archived starter content', () => {
  const fixture = temporaryDb();
  try {
    for (const fn of [setupAdminTest, readAdminTestOTP, recoverAdminTest]) assert.throws(() => fn(fixture.db, 'production'), /only in local-test/);
    assert.equal(count(fixture.db, 'users'), 0);
    fixture.db.prepare("UPDATE exercises SET instructions='Alex edited these cues',version=version+1 WHERE id='starter-squat'").run();
    fixture.db.prepare("UPDATE templates SET archived=1 WHERE id='starter-meals'").run();
    const result = setupAdminTest(fixture.db);
    assert.equal(result.samples.assignments, 0);
    assert.deepEqual(result.samples.skipped, ['starter-training', 'starter-meals']);
    assert.equal(count(fixture.db, 'assignments'), 0);
    assert.equal((fixture.db.prepare("SELECT instructions FROM exercises WHERE id='starter-squat'").get() as any).instructions, 'Alex edited these cues');
    assert.equal((fixture.db.prepare("SELECT archived FROM templates WHERE id='starter-meals'").get() as any).archived, 1);
  } finally { fixture.close(); }
});

test('Dedicated admin follows normal password plus TOTP login and one-use reset revokes sessions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ff-admin-login-')), origin = 'http://127.0.0.1:8085';
  const app = createApp({requireVerification:true, dataDir: dir, origin });
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const port = (app.server.address() as any).port;
  const call = (path: string, body: any) => new Promise<any>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: '/api' + path, method: 'POST', headers: { Host: '127.0.0.1:8085', Origin: origin, 'Content-Type': 'application/json' } }, res => {
      let text = ''; res.on('data', chunk => text += chunk); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(text), cookies: res.headers['set-cookie'] }));
    });
    req.on('error', reject); req.end(JSON.stringify(body));
  });
  try {
    const created = setupAdminTest(app.db);
    for (const credentials of [
      { email: adminTestEmail, password: 'incorrect password' },
      { email: 'missing-account@example.test', password: created.password },
    ]) {
      const rejected = await call('/auth/login', credentials);
      assert.equal(rejected.status, 401);
      assert.equal(rejected.data.error, 'Email or password is incorrect.');
      assert.equal(rejected.data.code, undefined, 'invalid credentials do not reveal the administrator challenge');
      assert.equal(rejected.cookies, undefined);
      assert.equal(count(app.db, 'sessions'), 0);
    }
    const testAdmin = app.db.prepare('SELECT totp_secret FROM users WHERE email=?').get(adminTestEmail) as any;
    let invalidOTP = '000000';
    while (totpOK(testAdmin.totp_secret, invalidOTP)) invalidOTP = String(Number(invalidOTP) + 1).padStart(6, '0');
    for (const otp of [undefined, invalidOTP]) {
      const challenged = await call('/auth/login', { email: adminTestEmail, password: created.password, otp });
      assert.equal(challenged.status, 401);
      assert.equal(challenged.data.code, 'authenticator_required');
      assert.equal(challenged.cookies, undefined, 'a password alone never issues a session cookie');
      assert.equal(count(app.db, 'sessions'), 0, 'administrator access waits for a valid authenticator code');
    }
    const signedIn = await call('/auth/login', { email: adminTestEmail, password: created.password, otp: readAdminTestOTP(app.db) });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.data.user.role, 'admin');
    assert.equal(signedIn.cookies.length, 1);
    assert.match(signedIn.cookies[0], /^ff_session=/);
    assert.equal(count(app.db, 'sessions'), 1);
    const before = app.db.prepare('SELECT * FROM users WHERE email=?').get(adminTestEmail) as any;
    const reset = recoverAdminTest(app.db);
    assert.deepEqual(app.db.prepare('SELECT * FROM users WHERE email=?').get(adminTestEmail), before, 'issuing recovery does not change credentials');
    const stored = app.db.prepare("SELECT * FROM tokens WHERE user_id=? AND kind='reset'").get(before.id) as any;
    assert.equal(stored.id, digest(reset));
    assert.ok(stored.expires > Date.now());
    assert.equal((await call('/auth/reset', { token: reset, password: 'a different test password 123' })).status, 200);
    assert.equal((await call('/auth/reset', { token: reset, password: 'cannot reuse this reset code' })).status, 400);
    assert.equal(count(app.db, 'sessions'), 0);
    assert.equal((app.db.prepare('SELECT totp_secret FROM users WHERE email=?').get(adminTestEmail) as any).totp_secret, before.totp_secret);
    assert.equal((await call('/auth/login', { email: adminTestEmail, password: 'a different test password 123', otp: readAdminTestOTP(app.db) })).status, 200);
    assert.equal(count(app.db, 'requests'), 2);
  } finally {
    await new Promise<void>(resolve => app.server.close(() => resolve()));
    app.db.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('Terminal setup prints private credentials once and offers a fresh-code command on repeats', () => {
  const fixture = temporaryDb();
  try {
    const run = (command: string) => spawnSync(process.execPath, ['src/manage.ts', command], { cwd: process.cwd(), env: { ...process.env, FF_MODE: 'local-test', FF_DATA_DIR: fixture.dir }, encoding: 'utf8' });
    const first = run('setup-admin-test');
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /Password: [a-f0-9]{32}/);
    assert.match(first.stdout, /Authenticator setup key: [A-Z2-7]{32}/);
    const repeat = run('setup-admin-test');
    assert.equal(repeat.status, 0, repeat.stderr);
    assert.doesNotMatch(repeat.stdout, /Password: |Authenticator setup key: /);
    assert.match(repeat.stdout, /read-test-otp/);
    assert.match(run('read-test-otp').stdout, /code: \d{6}/);
    assert.equal(count(fixture.db, 'users'), 3);
  } finally { fixture.close(); }
});
