import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, readdirSync, existsSync, statSync, writeFileSync, rmSync, chmodSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createEncryptedBackup, decryptBackup } from '../src/backup.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ff-backup-'));
  const db = new DatabaseSync(join(dir, 'source.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE entries(id INTEGER PRIMARY KEY, note TEXT);');
  db.prepare('INSERT INTO entries(note) VALUES (?)').run('private committed WAL content');
  return { dir, db, close() { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

function noTemporaryFiles(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    assert.doesNotMatch(entry.name, /^\.ff-(snapshot|archive|restore|key)-/);
    if (entry.isDirectory()) noTemporaryFiles(join(directory, entry.name));
  }
}

test('Encrypted snapshots include committed SQLite WAL data, reuse a private key and use a fresh nonce', async () => {
  const f = fixture();
  try {
    // Cross several encryption chunks while the committed changes remain in WAL.
    const largeNote = 'a private record '.repeat(12000);
    f.db.prepare('INSERT INTO entries(note) VALUES (?)').run(largeNote);
    assert.ok(statSync(join(f.dir, 'source.sqlite-wal')).size > 0);
    const archive = await createEncryptedBackup(f.db, f.dir);
    const key = readFileSync(join(f.dir, 'backup.key'));
    const second = await createEncryptedBackup(f.db, f.dir);
    const bytes = readFileSync(archive), other = readFileSync(second);
    assert.equal(bytes.subarray(0, 8).toString(), 'FFBACKUP');
    assert.equal(bytes[8], 1);
    assert.ok(!bytes.includes(Buffer.from('SQLite format 3')));
    assert.ok(!bytes.includes(Buffer.from('private committed WAL content')));
    assert.notDeepEqual(bytes.subarray(9, 21), other.subarray(9, 21));
    assert.deepEqual(readFileSync(join(f.dir, 'backup.key')), key);
    assert.equal(key.length, 32);
    for (const path of [archive, second, join(f.dir, 'backup.key'), join(f.dir, 'backup-key-id')]) assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(statSync(join(f.dir, 'backups')).mode & 0o777, 0o700);
    const restored = await decryptBackup(f.dir, archive, join(f.dir, 'restored.sqlite'));
    assert.equal(statSync(restored).mode & 0o777, 0o600);
    const db = new DatabaseSync(restored, { readOnly: true });
    try {
      assert.equal((db.prepare('SELECT note FROM entries WHERE id=1').get() as any).note, 'private committed WAL content');
      assert.equal((db.prepare('SELECT note FROM entries WHERE id=2').get() as any).note, largeNote);
    }
    finally { db.close(); }
    noTemporaryFiles(f.dir);
  } finally { f.close(); }
});

test('Tampered headers, ciphertext, tags, unknown versions and truncated archives produce no plaintext destination', async () => {
  const f = fixture();
  try {
    const archive = await createEncryptedBackup(f.db, f.dir);
    const original = readFileSync(archive);
    const changes = [0, 8, 9, 21, original.length - 1];
    for (const offset of changes) {
      const bytes = Buffer.from(original); bytes[offset] ^= 0xff;
      const bad = join(f.dir, 'modified.ffbackup');
      writeFileSync(bad, bytes, { mode: 0o600 });
      const destination = join(f.dir, 'must-not-exist.sqlite');
      await assert.rejects(decryptBackup(f.dir, bad, destination), /Unsupported|authentication failed/);
      assert.equal(existsSync(destination), false); noTemporaryFiles(f.dir);
    }
    const truncated = join(f.dir, 'truncated.ffbackup');
    writeFileSync(truncated, original.subarray(0, 30), { mode: 0o600 });
    await assert.rejects(decryptBackup(f.dir, truncated, join(f.dir, 'must-not-exist.sqlite')), /Invalid encrypted backup/);
    assert.equal(existsSync(join(f.dir, 'must-not-exist.sqlite')), false);
  } finally { f.close(); }
});

test('Wrong key cannot decrypt even in a different valid data directory', async () => {
  const f = fixture(), other = fixture();
  try {
    const archive = await createEncryptedBackup(f.db, f.dir);
    await createEncryptedBackup(other.db, other.dir);
    const destination = join(other.dir, 'must-not-exist.sqlite');
    await assert.rejects(decryptBackup(other.dir, archive, destination), /authentication failed/);
    assert.equal(existsSync(destination), false); noTemporaryFiles(other.dir);
  } finally { f.close(); other.close(); }
});

test('Missing, replaced, invalid and publicly readable keys fail rather than silently rotating', async () => {
  const f = fixture();
  try {
    const archive = await createEncryptedBackup(f.db, f.dir);
    const keyPath = join(f.dir, 'backup.key'), original = readFileSync(keyPath);
    rmSync(keyPath);
    await assert.rejects(createEncryptedBackup(f.db, f.dir), /key is missing/);
    await assert.rejects(decryptBackup(f.dir, archive, join(f.dir, 'restored.sqlite')), /key is missing/);
    assert.equal(existsSync(keyPath), false);
    writeFileSync(keyPath, Buffer.alloc(32, 42), { mode: 0o600 });
    await assert.rejects(createEncryptedBackup(f.db, f.dir), /does not match/);
    writeFileSync(keyPath, Buffer.alloc(3));
    await assert.rejects(createEncryptedBackup(f.db, f.dir), /invalid/);
    writeFileSync(keyPath, original); chmodSync(keyPath, 0o644);
    await assert.rejects(createEncryptedBackup(f.db, f.dir), /invalid/);
    chmodSync(keyPath, 0o600);
    await decryptBackup(f.dir, archive, join(f.dir, 'restored.sqlite'));
    noTemporaryFiles(f.dir);
  } finally { f.close(); }
});

test('Archives and decrypted exports never overwrite an existing file or symlink', async () => {
  const f = fixture();
  try {
    const archive = await createEncryptedBackup(f.db, f.dir);
    const original = readFileSync(archive);
    await assert.rejects(createEncryptedBackup(f.db, f.dir, archive), /already exists/);
    assert.deepEqual(readFileSync(archive), original);
    const existing = join(f.dir, 'existing.sqlite'); writeFileSync(existing, 'keep this');
    await assert.rejects(decryptBackup(f.dir, archive, existing), /already exists/);
    assert.equal(readFileSync(existing, 'utf8'), 'keep this');
    const linked = join(f.dir, 'linked.sqlite'); symlinkSync(existing, linked);
    await assert.rejects(decryptBackup(f.dir, archive, linked), /already exists/);
    await assert.rejects(createEncryptedBackup(f.db, f.dir, join(f.dir, 'misleading.sqlite')), /must end in .ffbackup/);
    noTemporaryFiles(f.dir);
  } finally { f.close(); }
});

test('Existing encrypted archives prevent silent key creation if both key and record are lost', async () => {
  const f = fixture();
  try {
    await createEncryptedBackup(f.db, f.dir);
    rmSync(join(f.dir, 'backup.key')); rmSync(join(f.dir, 'backup-key-id'));
    await assert.rejects(createEncryptedBackup(f.db, f.dir), /key is missing/);
    assert.equal(existsSync(join(f.dir, 'backup.key')), false);
    noTemporaryFiles(f.dir);
  } finally { f.close(); }
});

test('Backup keys and archive inputs do not follow symbolic links', async () => {
  const f = fixture();
  try {
    const archive = await createEncryptedBackup(f.db, f.dir);
    const archiveLink = join(f.dir, 'linked.ffbackup'); symlinkSync(archive, archiveLink);
    await assert.rejects(decryptBackup(f.dir, archiveLink, join(f.dir, 'must-not-exist.sqlite')));
    assert.equal(existsSync(join(f.dir, 'must-not-exist.sqlite')), false);
    const keyPath = join(f.dir, 'backup.key'), realKey = join(f.dir, 'actual.key');
    writeFileSync(realKey, readFileSync(keyPath), { mode: 0o600 }); rmSync(keyPath); symlinkSync(realKey, keyPath);
    await assert.rejects(createEncryptedBackup(f.db, f.dir));
    noTemporaryFiles(f.dir);
  } finally { f.close(); }
});

test('Snapshot failure cleans plaintext staging and does not publish an archive', async () => {
  const f = fixture();
  f.db.close();
  try {
    const destination = join(f.dir, 'failed.ffbackup');
    await assert.rejects(createEncryptedBackup(f.db, f.dir, destination));
    assert.equal(existsSync(destination), false); noTemporaryFiles(f.dir);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('External key file requires its own private directory and is never embedded in the archive', async () => {
  const f = fixture();
  const previous = process.env.FF_BACKUP_KEY_FILE;
  try {
    const privateKeys = join(f.dir, 'private-keys');
    mkdirSync(privateKeys, { mode: 0o700 });
    process.env.FF_BACKUP_KEY_FILE = join(privateKeys, 'chosen.key');
    const archive = await createEncryptedBackup(f.db, f.dir);
    const key = readFileSync(process.env.FF_BACKUP_KEY_FILE);
    assert.equal(existsSync(join(f.dir, 'backup.key')), false);
    assert.ok(!readFileSync(archive).includes(key));
    await decryptBackup(f.dir, archive, join(f.dir, 'restored.sqlite'));
    chmodSync(privateKeys, 0o755);
    await assert.rejects(createEncryptedBackup(f.db, f.dir), /private permissions/);
    assert.equal(statSync(privateKeys).mode & 0o777, 0o755);
  } finally {
    if (previous === undefined) delete process.env.FF_BACKUP_KEY_FILE; else process.env.FF_BACKUP_KEY_FILE = previous;
    f.close();
  }
});

test('Offline decrypt CLI exports without opening or creating the live database', async () => {
  const f = fixture();
  try {
    const archive = await createEncryptedBackup(f.db, f.dir);
    const restored = join(f.dir, 'cli-restored.sqlite');
    const result = spawnSync(process.execPath, ['src/manage.ts', 'decrypt-backup', archive, restored], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, FF_DATA_DIR: f.dir }, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(restored), true);
    assert.equal(existsSync(join(f.dir, 'form-fire.sqlite')), false);
    assert.match(result.stdout, /plaintext/); noTemporaryFiles(f.dir);
  } finally { f.close(); }
});

for (const code of ['EACCES', 'EPERM', 'ENOTSUP', 'EXDEV']) {
  test(`Hard-link ${code} fallback encrypts, restores and preserves the original private key`, async t => {
    const fs = (await import('node:fs/promises')).default;
    t.mock.method(fs, 'link', async () => { throw Object.assign(Error('Hard links unavailable'), { code }); });
    const f = fixture();
    try {
      const large = 'Termux fallback content '.repeat(12000);
      f.db.prepare('INSERT INTO entries(note) VALUES (?)').run(large);
      const archive = await createEncryptedBackup(f.db, f.dir);
      const originalKey = readFileSync(join(f.dir, 'backup.key'));
      await createEncryptedBackup(f.db, f.dir);
      assert.deepEqual(readFileSync(join(f.dir, 'backup.key')), originalKey);
      const destination = await decryptBackup(f.dir, archive, join(f.dir, 'fallback.sqlite'));
      const restored = new DatabaseSync(destination, { readOnly: true });
      try { assert.equal((restored.prepare('SELECT note FROM entries WHERE id=2').get() as any).note, large); }
      finally { restored.close(); }
      for (const path of [archive, destination, join(f.dir, 'backup.key'), join(f.dir, 'backup-key-id')]) {
        assert.equal(statSync(path).mode & 0o777, 0o600);
      }
      const bad = Buffer.from(readFileSync(archive)); bad[bad.length - 1] ^= 1;
      const damaged = join(f.dir, 'damaged.ffbackup'); writeFileSync(damaged, bad);
      await assert.rejects(decryptBackup(f.dir, damaged, join(f.dir, 'bad.sqlite')), /authentication failed/);
      assert.equal(existsSync(join(f.dir, 'bad.sqlite')), false);
      noTemporaryFiles(f.dir);
    } finally { f.close(); }
  });
}

test('Fallback publication never overwrites a destination created after its initial existence check', async t => {
  const fs = (await import('node:fs/promises')).default;
  const f = fixture();
  try {
    const archive = await createEncryptedBackup(f.db, f.dir);
    const destination = join(f.dir, 'raced.sqlite');
    const target = join(f.dir, 'keep.sqlite'); writeFileSync(target, 'keep this');
    t.mock.method(fs, 'link', async (_source, path) => {
      symlinkSync(target, path);
      throw Object.assign(Error('Hard links unavailable'), { code: 'EACCES' });
    });
    await assert.rejects(decryptBackup(f.dir, archive, destination), { code: 'EEXIST' });
    assert.equal(readFileSync(target, 'utf8'), 'keep this');
    assert.equal(readFileSync(destination, 'utf8'), 'keep this');
    noTemporaryFiles(f.dir);
  } finally { f.close(); }
});

test('Fallback write failures clean partial destinations and preserve keys for a safe retry', async t => {
  const fs = (await import('node:fs/promises')).default;
  const actualOpen = fs.open.bind(fs);
  const f = fixture();
  try {
    const archive = await createEncryptedBackup(f.db, f.dir);
    const key = readFileSync(join(f.dir, 'backup.key'));
    t.mock.method(fs, 'link', async () => { throw Object.assign(Error('Hard links unavailable'), { code: 'EACCES' }); });
    for (const kind of ['archive', 'restore', 'key']) {
      const destination = join(f.dir, kind === 'archive' ? 'failed.ffbackup' : kind === 'restore' ? 'failed.sqlite' : 'backup.key');
      // Only the key case starts a separate empty data directory.
      const fresh = kind === 'key' ? fixture() : f;
      const failingPath = kind === 'key' ? join(fresh.dir, 'backup.key') : destination;
      const openMock = t.mock.method(fs, 'open', async (path, flags, mode) => {
        const handle = await actualOpen(path, flags, mode);
        if (path === failingPath && flags === 'wx') {
          const write = handle.write.bind(handle);
          t.mock.method(handle, 'write', async (...args) => {
            await write(...args);
            throw Object.assign(Error('Disk full'), { code: 'ENOSPC' });
          });
        }
        return handle;
      });
      try {
        if (kind === 'restore') await assert.rejects(decryptBackup(f.dir, archive, failingPath), { code: 'ENOSPC' });
        else await assert.rejects(createEncryptedBackup(fresh.db, fresh.dir, kind === 'archive' ? failingPath : undefined), { code: 'ENOSPC' });
        assert.equal(existsSync(failingPath), false);
        assert.deepEqual(readFileSync(join(f.dir, 'backup.key')), key);
        noTemporaryFiles(fresh.dir);
      } finally { openMock.mock.restore(); if (fresh !== f) fresh.close(); }
    }
    await createEncryptedBackup(f.db, f.dir);
    noTemporaryFiles(f.dir);
  } finally { f.close(); }
});
