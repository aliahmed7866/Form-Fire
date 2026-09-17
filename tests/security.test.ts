import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest, createServer } from 'node:http';
import { request as httpsRequest, createServer as createSecureServer } from 'node:https';
import { scryptSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, chmodSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server.ts';
import { transportConfig } from '../src/transport.ts';
import { healthcheck } from '../src/healthcheck.ts';
import { id, openDb } from '../src/db.ts';
import { digest, passwordHash, passwordNeedsUpgrade, passwordOK, totp, totpSecret } from '../src/auth.ts';

// Public, committed fixtures for loopback tests only. Never use these keys to host an app.
// HTTPS clients explicitly trust this fixture certificate; TLS verification stays enabled.
const certFile = fileURLToPath(new URL('fixtures/loopback-test-cert.pem', import.meta.url));
const keyFile = fileURLToPath(new URL('fixtures/loopback-test-key.pem', import.meta.url));
const certificate = readFileSync(certFile);
const tlsEnv = { FF_TLS_CERT_FILE: certFile, FF_TLS_KEY_FILE: keyFile };
const origin = 'http://127.0.0.1:8085';
const password = 'Only fictional security test password';

async function fixture(secure = false) {
  const dir = mkdtempSync(join(tmpdir(), 'ff-security-'));
  const oldCert = process.env.FF_TLS_CERT_FILE, oldKey = process.env.FF_TLS_KEY_FILE;
  try {
    if (secure) Object.assign(process.env, tlsEnv);
    else { delete process.env.FF_TLS_CERT_FILE; delete process.env.FF_TLS_KEY_FILE; }
    const app = createApp({requireVerification:true, dataDir: dir, origin: secure ? origin.replace('http:', 'https:') : origin });
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const port = (app.server.address() as any).port;
    const call = (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => new Promise<any>((resolve, reject) => {
      const request = secure ? httpsRequest : httpRequest;
      const req = request({ hostname: '127.0.0.1', port, path, method,
        ...(secure ? { ca: certificate } : {}),
        headers: { Host: '127.0.0.1:8085', Origin: secure ? origin.replace('http:', 'https:') : origin,
          'Content-Type': 'application/json', ...headers } }, response => {
        let text = '';
        response.on('data', chunk => text += chunk);
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text,
          data: response.headers['content-type']?.startsWith('application/json') ? JSON.parse(text) : undefined }));
        response.on('error', reject);
      });
      req.on('error', reject);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
    return { ...app, dir, call, async close() {
      await new Promise<void>(resolve => app.server.close(() => resolve()));
      app.db.close(); rmSync(dir, { recursive: true, force: true });
    } };
  } catch (error) { rmSync(dir, { recursive: true, force: true }); throw error; }
  finally {
    if (oldCert === undefined) delete process.env.FF_TLS_CERT_FILE; else process.env.FF_TLS_CERT_FILE = oldCert;
    if (oldKey === undefined) delete process.env.FF_TLS_KEY_FILE; else process.env.FF_TLS_KEY_FILE = oldKey;
  }
}

await test('Transport accepts only canonical loopback origins and complete matching TLS configuration', () => {
  const plain = transportConfig({ FF_ORIGIN: origin, FF_HOST: '127.0.0.1', FF_PORT: '8085' });
  assert.equal(plain.origin, origin);
  assert.equal(plain.host, '127.0.0.1');
  assert.equal(plain.port, 8085);
  assert.equal(plain.tls, undefined);
  for (const invalid of ['http://public.example:8085', 'http://127.0.0.1:8085/', 'http://127.0.0.1:8085/admin', 'http://127.0.0.1:8085?x=1', 'http://127.0.0.1:8085#admin', 'http://admin:password@127.0.0.1:8085', 'ftp://127.0.0.1:8085']) {
    assert.throws(() => transportConfig({ FF_ORIGIN: invalid }), undefined, invalid);
  }
  for (const port of ['0', '65536', 'invalid']) assert.throws(() => transportConfig({ FF_PORT: port }));
  assert.throws(() => transportConfig({ FF_HOST: '0.0.0.0' }));
  assert.throws(() => transportConfig({ FF_PORT: '8085', FF_ORIGIN: 'http://127.0.0.1:8086' }), /port must match/);
  assert.throws(() => transportConfig({ FF_HOST: '::1', FF_ORIGIN: origin }), /address must match/);
  assert.throws(() => transportConfig({ FF_HOST: '127.0.0.1', FF_ORIGIN: 'http://[::1]:8085' }), /address must match/);
  assert.equal(transportConfig({ FF_HOST: '::1', FF_ORIGIN: 'http://[::1]:8085' }).host, '::1');
  assert.equal(transportConfig({ FF_PORT: '80', FF_ORIGIN: 'http://127.0.0.1' }).port, 80);
  assert.equal(transportConfig({ FF_PORT: '80' }).origin, 'http://127.0.0.1');
  assert.equal(transportConfig({ FF_PORT: '443', ...tlsEnv }).origin, 'https://127.0.0.1');
  assert.equal(transportConfig({ FF_HOST: '127.0.0.1', FF_ORIGIN: 'http://localhost:8085' }).origin, 'http://localhost:8085');
  assert.equal(transportConfig({ FF_PORT: '8086' }, origin).origin, origin);
  assert.throws(() => transportConfig({ FF_ORIGIN: origin, FF_TLS_CERT_FILE: certFile }));
  assert.throws(() => transportConfig({ FF_ORIGIN: origin, FF_TLS_KEY_FILE: keyFile }));
  assert.throws(() => transportConfig({ FF_ORIGIN: origin.replace('http:', 'https:') }));
  assert.throws(() => transportConfig({ FF_ORIGIN: origin, ...tlsEnv }));
  const secure = transportConfig({ FF_ORIGIN: origin.replace('http:', 'https:'), ...tlsEnv });
  assert.ok(secure.tls);
});

await test('HTTP boundary denies forged hosts, origins, content types and oversized bodies without exposing internals', async () => {
  const app = await fixture();
  try {
    assert.equal((await app.call('/health', 'GET', undefined, { Host: 'evil.example' })).status, 403);
    assert.equal((await app.call('/api/auth/login', 'POST', {}, { Origin: 'https://evil.example' })).status, 403);
    for (const mediaType of ['text/plain', 'application/json-malformed']) {
      assert.equal((await app.call('/api/auth/login', 'POST', {}, { 'Content-Type': mediaType })).status, 415);
    }
    const oversized = await app.call('/api/auth/login', 'POST', { email: 'x'.repeat(70000) });
    assert.equal(oversized.status, 413);
    assert.match(oversized.data.error, /too large/i);
    const response = await app.call('/api/session');
    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
    for (const feature of ['camera', 'microphone', 'geolocation']) assert.ok(response.headers['permissions-policy'].includes(feature + '=()'));
    assert.equal(app.server.headersTimeout, 10000);
    assert.equal(app.server.requestTimeout, 15000);
    for (const path of ['/src/server.ts', '/data/form-fire.sqlite', '/.config/form-fire/env', '/..%2f..%2fsrc%2fauth.ts']) {
      const result = await app.call(path);
      assert.ok(result.status === 404 || result.headers['content-type']?.startsWith('text/html'));
      assert.ok(!result.text.includes('scryptSync') && !result.text.includes('CREATE TABLE') && !result.text.includes('SQLite format'));
    }
    assert.ok(!/password|totp_secret|FF_TLS_KEY|FF_GOOGLE_CLIENT_SECRET/.test(response.text));
  } finally { await app.close(); }
});

await test('SQL payloads remain data and account input cannot grant administrator or another client access', async () => {
  const app = await fixture();
  try {
    const adminId = id(), ownerId = id(), outsiderId = id(), secret = totpSecret();
    const insert = app.db.prepare('INSERT INTO users(id,email,name,password,role,verified,totp_secret) VALUES(?,?,?,?,?,1,?)');
    const salt = 'a'.repeat(32), legacyHash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
    insert.run(adminId, 'private-admin@example.test', 'Alex', legacyHash, 'admin', secret);
    insert.run(ownerId, 'owner@example.test', 'Owner', passwordHash(password), 'client', null);
    insert.run(outsiderId, 'outsider@example.test', 'Other client', passwordHash(password), 'client', null);
    const injectedEmail = "private-admin@example.test' OR '1'='1";
    const attempt = await app.call('/api/auth/login', 'POST', { email: injectedEmail, password, role: 'admin' });
    assert.equal(attempt.status, 401);
    assert.equal(attempt.data.code, undefined);
    assert.equal(attempt.headers['set-cookie'], undefined);
    assert.equal((app.db.prepare('SELECT COUNT(*) n FROM sessions').get() as any).n, 0);
    const name = "Client'); DROP TABLE users; --";
    const registered = await app.call('/api/auth/register', 'POST', { email: 'registered@example.test', name, password, role: 'admin', verified: 1, totp_secret: secret });
    assert.equal(registered.status, 201);
    const saved = app.db.prepare('SELECT * FROM users WHERE email=?').get('registered@example.test') as any;
    assert.equal(saved.name, name); assert.equal(saved.role, 'client'); assert.equal(saved.verified, 0); assert.equal(saved.totp_secret, null);
    const login = await app.call('/api/auth/login', 'POST', { email: 'owner@example.test', password, role: 'admin' });
    assert.equal(login.status, 200); assert.equal(login.data.user.role, 'client');
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const headers = { Cookie: cookie, 'X-CSRF-Token': login.data.csrf };
    assert.equal((await app.call('/api/profile', 'PUT', { name, role: 'admin', verified: 1, totp_secret: secret }, headers)).status, 200);
    assert.equal((app.db.prepare('SELECT role FROM users WHERE id=?').get(ownerId) as any).role, 'client');
    for (const path of ['/api/admin/dashboard', '/api/admin/activity']) assert.equal((await app.call(path, 'GET', undefined, headers)).status, 403);
    assert.equal((await app.call('/api/admin/services', 'POST', {}, headers)).status, 403);
    assert.equal((await app.call('/api/profile', 'PUT', { name: 'Forged' }, { Cookie: cookie })).status, 403);
    const requestId = id();
    app.db.prepare("INSERT INTO requests(id,user_id,service_id,kind,details,idempotency_key) VALUES(?,?,'both','coaching','{}',?)").run(requestId, outsiderId, id());
    assert.equal((await app.call('/api/requests/' + requestId, 'GET', undefined, headers)).status, 404);
    assert.equal((await app.call('/api/requests/' + requestId + '/reply', 'POST', { body: 'Intrusion' }, headers)).status, 404);
    assert.equal((await app.call('/api/requests/' + encodeURIComponent("' OR 1=1--"), 'GET', undefined, headers)).status, 404);
    const wrongPassword = await app.call('/api/auth/login', 'POST', { email: 'private-admin@example.test', password: 'Incorrect password', otp: totp(secret) });
    assert.equal(wrongPassword.status, 401); assert.equal(wrongPassword.data.code, undefined);
    assert.equal((app.db.prepare('SELECT password FROM users WHERE id=?').get(adminId) as any).password, legacyHash);
    const wrongCode = await app.call('/api/auth/login', 'POST', { email: 'private-admin@example.test', password, otp: 'invalid' });
    assert.equal(wrongCode.status, 401); assert.equal(wrongCode.headers['set-cookie'], undefined);
    assert.equal((app.db.prepare('SELECT password FROM users WHERE id=?').get(adminId) as any).password, legacyHash);
    const challenge = await app.call('/api/auth/login', 'POST', { email: 'private-admin@example.test', password });
    assert.equal(challenge.status, 401); assert.equal(challenge.data.code, 'authenticator_required'); assert.equal(challenge.headers['set-cookie'], undefined);
    assert.equal((app.db.prepare('SELECT password FROM users WHERE id=?').get(adminId) as any).password, legacyHash);
    const admin = await app.call('/api/auth/login', 'POST', { email: 'private-admin@example.test', password, otp: totp(secret) });
    assert.equal(admin.status, 200); assert.equal(admin.data.user.role, 'admin');
    const upgraded = (app.db.prepare('SELECT password FROM users WHERE id=?').get(adminId) as any).password;
    assert.notEqual(upgraded, legacyHash); assert.equal(passwordNeedsUpgrade(upgraded), false); assert.equal(passwordOK(password, upgraded), true);
    assert.ok(!/totp_secret|password|admin_notes/.test(JSON.stringify(admin.data.user)));
    assert.equal((app.db.prepare('SELECT COUNT(*) n FROM users').get() as any).n, 4);
  } finally { await app.close(); }
});

await test('Health checks use the configured HTTP or verified HTTPS origin', async () => {
  for (const secure of [false, true]) {
    const handle = (_req: any, response: any) => response.end(JSON.stringify({ ok: true, app: 'form-fire' }));
    const server = secure ? createSecureServer({ cert: certificate, key: readFileSync(keyFile) }, handle) : createServer(handle);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as any).port;
      const env = { FF_ORIGIN: `${secure ? 'https' : 'http'}://127.0.0.1:${port}`, FF_PORT: String(port), ...(secure ? tlsEnv : {}) };
      assert.deepEqual(await healthcheck(env), { ok: true, app: 'form-fire' });
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});

await test('Native HTTPS completes verified TLS and sets secure hashed server sessions', async () => {
  const app = await fixture(true);
  try {
    const userId = id();
    app.db.prepare("INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,'client',1)").run(userId, 'tls@example.test', 'TLS client', passwordHash(password));
    assert.equal((await app.call('/health')).status, 200);
    const login = await app.call('/api/auth/login', 'POST', { email: 'tls@example.test', password });
    assert.equal(login.status, 200);
    const cookie = login.headers['set-cookie'][0];
    for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/']) assert.ok(cookie.includes(flag));
    const rawToken = cookie.split(';')[0].slice('ff_session='.length);
    assert.equal(app.db.prepare('SELECT id FROM sessions WHERE id=?').get(rawToken), undefined);
    const session = app.db.prepare('SELECT user_id FROM sessions WHERE id=?').get(digest(rawToken)) as any;
    assert.equal(session.user_id, userId);
    const current = await app.call('/api/session', 'GET', undefined, { Cookie: cookie.split(';')[0] });
    assert.equal(current.data.user.id, userId);
    const google = await app.call('/api/auth/google/status');
    assert.equal(google.data.redirect_uri, 'https://127.0.0.1:8085/api/auth/google/callback');
  } finally { await app.close(); }
});

await test('Opening an existing data directory tightens directory, database and WAL permissions', () => {
  const root = mkdtempSync(join(tmpdir(), 'ff-permissions-')), directory = join(root, 'data');
  mkdirSync(directory, { mode: 0o755 }); chmodSync(directory, 0o755);
  const db = openDb(directory);
  try {
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    for (const suffix of ['', '-wal', '-shm']) {
      const path = join(directory, 'form-fire.sqlite' + suffix);
      assert.ok(existsSync(path), path);
      assert.equal(statSync(path).mode & 0o777, 0o600);
    }
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
