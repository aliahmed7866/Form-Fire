import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { decryptBackup } from '../src/backup.ts';

const recoveryScript = resolve('termux/recover-backup-update.sh');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ff-update-test-'));
  const repo = join(root, 'repo'), config = join(root, 'config'), data = join(root, 'data');
  for (const dir of [repo, config, data, join(repo, 'src'), join(repo, 'termux')]) mkdirSync(dir, { mode: 0o700 });
  const env = { ...process.env, FF_CONFIG_DIR: config, FF_DATA_DIR: data, TMPDIR: root,
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' };
  function git(...args: string[]) {
    const r = spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  }
  git('init', '-b', 'main');
  writeFileSync(join(repo, 'src/backup.ts'), "throw Error('Old hard-link-only backup must not run');\n");
  git('add', '.'); git('commit', '-m', 'old app'); const before = git('rev-parse', 'HEAD');
  writeFileSync(join(repo, 'src/backup.ts'), readFileSync('src/backup.ts'));
  // Observe the handoff without requiring Android's service manager on Linux.
  writeFileSync(join(repo, 'termux/update.sh'), 'set -e\n[ -f "$FF_DATA_DIR/backup.key" ]\nls "$FF_DATA_DIR"/backups/*.ffbackup >/dev/null\nprintf done > "$FF_DATA_DIR/handoff"\n');
  git('add', '.'); git('commit', '-m', 'fixed backup'); const after = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', after); git('checkout', '--detach', before);
  writeFileSync(join(config, 'env'), 'export FF_MODE=local-test\n', { mode: 0o600 });
  const db = new DatabaseSync(join(data, 'form-fire.sqlite'));
  db.exec("CREATE TABLE entries(note TEXT); INSERT INTO entries VALUES('keep the existing client data');"); db.close();
  const preload = join(root, 'deny-links.mjs');
  writeFileSync(preload, "import fs from 'node:fs/promises'; fs.link = async () => { throw Object.assign(Error('Android hard-link denial'), { code: 'EACCES' }); };\n");
  const run = () => spawnSync('bash', [recoveryScript], { cwd: repo, env: { ...env, NODE_OPTIONS: `--import=${preload}` }, encoding: 'utf8' });
  return { root, repo, data, git, before, after, run, close() { rmSync(root, { recursive: true, force: true }); } };
}

test('Recovery backs up the existing database with fetched code before fast-forward and updater handoff', async () => {
  const f = fixture();
  try {
    const r = f.run(); assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(f.git('rev-parse', 'HEAD'), f.after);
    assert.equal(readFileSync(join(f.data, 'handoff'), 'utf8'), 'done');
    const archives = readdirSync(join(f.data, 'backups')).filter(p => p.endsWith('.ffbackup'));
    assert.equal(archives.length, 1);
    const restored = await decryptBackup(f.data, join(f.data, 'backups', archives[0]), join(f.root, 'restore.sqlite'));
    const db = new DatabaseSync(restored, { readOnly: true });
    try { assert.equal((db.prepare('SELECT note FROM entries').get() as any).note, 'keep the existing client data'); }
    finally { db.close(); }
    assert.equal(readdirSync(f.root).some(p => p.startsWith('ff-update-')), false);
  } finally { f.close(); }
});

test('Recovery leaves the checkout and service untouched when the original key is missing', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.data, 'backup-key-id'), 'a'.repeat(64), { mode: 0o600 });
    const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /key is missing/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.before);
    assert.equal(existsSync(join(f.data, 'backup.key')), false);
    assert.equal(existsSync(join(f.data, 'handoff')), false);
  } finally { f.close(); }
});

test('Recovery refuses local checkout edits before creating keys or changing the app', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.repo, 'src/backup.ts'), '// local work\n');
    const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /Working tree has changes/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.before);
    assert.equal(existsSync(join(f.data, 'backup.key')), false);
    assert.equal(readFileSync(join(f.repo, 'src/backup.ts'), 'utf8'), '// local work\n');
  } finally { f.close(); }
});
