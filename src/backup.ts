import { backup, type DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import fs, { open, mkdir, mkdtemp, lstat, readdir, rm } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

// Version 1: magic (8), version (1), nonce (12), ciphertext, GCM tag (16).
// The complete header is authenticated. The key never appears in the archive.
const MAGIC = Buffer.from('FFBACKUP');
const HEADER_BYTES = 21, TAG_BYTES = 16, CHUNK_BYTES = 64 * 1024;
const NOFOLLOW = constants.O_NOFOLLOW || 0;

async function privateDirectory(path: string) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (!info.isDirectory() || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid())) {
    throw Error('Backup key and data directories must be owned by this account with private permissions (700).');
  }
}

async function absent(path: string) {
  try { await lstat(path); }
  catch (error: any) { if (error.code === 'ENOENT') return; throw error; }
  throw Error('Destination already exists; refusing to overwrite it.');
}

async function readPrivate(path: string, length: number) {
  const file = await open(path, constants.O_RDONLY | NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid()) || info.size !== length) {
      throw Error('Backup key or key record is invalid; use the original owner-only key file (600).');
    }
    return await file.readFile();
  } finally { await file.close(); }
}

async function writeAll(file: FileHandle, bytes: Buffer) {
  for (let offset = 0; offset < bytes.length;) {
    const { bytesWritten } = await file.write(bytes, offset, bytes.length - offset);
    if (!bytesWritten) throw Error('Could not write backup data.');
    offset += bytesWritten;
  }
}

// Prefer atomic publication. Android can deny hard links even in private Termux
// storage. Fall back to an exclusive, owner-only copy, never an overwriting rename.
// A fallback destination is visible while copying; readers must fail closed on
// incomplete keys/archives. Ordinary failures remove only the file we created.
async function publishPrivate(staging: string, destination: string) {
  try { await fs.link(staging, destination); return; }
  catch (error: any) {
    if (!['EACCES', 'EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EXDEV'].includes(error.code)) throw error;
  }
  const source = await open(staging, constants.O_RDONLY | NOFOLLOW);
  let output: FileHandle | undefined;
  try {
    output = await fs.open(destination, 'wx', 0o600);
    const buffer = Buffer.alloc(CHUNK_BYTES);
    while (true) {
      const { bytesRead } = await source.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      await writeAll(output, buffer.subarray(0, bytesRead));
    }
    await output.sync();
  } catch (error) {
    if (output) {
      const own = await output.stat();
      const current = await lstat(destination).catch((e: any) => { if (e.code !== 'ENOENT') throw e; });
      if (current && current.dev === own.dev && current.ino === own.ino) await rm(destination);
    }
    throw error;
  } finally { try { await output?.close(); } finally { await source.close(); } }
}

// Stage complete key material before publishing it beside its destination.
async function createPrivate(path: string, bytes: Buffer) {
  const temporary = await mkdtemp(join(dirname(path), '.ff-key-'));
  try {
    const staging = join(temporary, 'key');
    const file = await open(staging, 'wx', 0o600);
    try { await writeAll(file, bytes); await file.sync(); } finally { await file.close(); }
    await publishPrivate(staging, path);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

async function existingArchives(directories: string[]) {
  for (const directory of new Set(directories)) {
    try { if ((await readdir(directory)).some(name => name.endsWith('.ffbackup'))) return true; }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
  return false;
}

async function backupKey(dataDir: string, create: boolean, archiveDir: string) {
  const keyPath = resolve(process.env.FF_BACKUP_KEY_FILE || join(dataDir, 'backup.key'));
  const recordPath = join(dataDir, 'backup-key-id');
  await privateDirectory(dataDir);
  await privateDirectory(dirname(keyPath));
  let record: Buffer | undefined;
  try { record = await readPrivate(recordPath, 64); }
  catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  let key: Buffer;
  try { key = await readPrivate(keyPath, 32); }
  catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
    if (!create || record || await existingArchives([join(dataDir, 'backups'), archiveDir])) {
      throw Error('The backup encryption key is missing. Restore the original backup.key; a replacement cannot decrypt existing backups.');
    }
    try { await createPrivate(keyPath, randomBytes(32)); }
    catch (writeError: any) { if (writeError.code !== 'EEXIST') throw writeError; }
    key = await readPrivate(keyPath, 32);
  }
  const fingerprint = Buffer.from(createHash('sha256').update(key).digest('hex'));
  if (record && !record.equals(fingerprint)) {
    key.fill(0);
    throw Error('The backup encryption key does not match this data directory. Restore its original key.');
  }
  if (create && !record) {
    try { await createPrivate(recordPath, fingerprint); }
    catch (error: any) { if (error.code !== 'EEXIST') { key.fill(0); throw error; } }
    if (!(await readPrivate(recordPath, 64)).equals(fingerprint)) {
      key.fill(0);
      throw Error('The backup encryption key changed. Retry with the original key.');
    }
  }
  return key;
}

export async function createEncryptedBackup(db: DatabaseSync, dataDir: string, destination?: string) {
  dataDir = resolve(dataDir);
  const archive = resolve(destination || join(dataDir, 'backups', `form-fire-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(4).toString('hex')}.ffbackup`));
  if (!archive.endsWith('.ffbackup')) throw Error('Encrypted backup destinations must end in .ffbackup.');
  await absent(archive);
  await mkdir(dirname(archive), { recursive: true, mode: 0o700 });
  const key = await backupKey(dataDir, true, dirname(archive));
  let snapshotDir: string | undefined, archiveDir: string | undefined;
  try {
    snapshotDir = await mkdtemp(join(dataDir, '.ff-snapshot-'));
    const snapshot = join(snapshotDir, 'snapshot.sqlite');
    // Pre-create with owner-only permissions before SQLite writes any bytes.
    await (await open(snapshot, 'wx', 0o600)).close();
    await backup(db, snapshot);
    archiveDir = await mkdtemp(join(dirname(archive), '.ff-archive-'));
    const staging = join(archiveDir, 'archive');
    const source = await open(snapshot, constants.O_RDONLY | NOFOLLOW);
    let output: FileHandle | undefined;
    try {
      output = await open(staging, 'wx', 0o600);
      const nonce = randomBytes(12);
      const header = Buffer.concat([MAGIC, Buffer.from([1]), nonce]);
      const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
      cipher.setAAD(header);
      await writeAll(output, header);
      const buffer = Buffer.alloc(CHUNK_BYTES);
      while (true) {
        const { bytesRead } = await source.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        await writeAll(output, cipher.update(buffer.subarray(0, bytesRead)));
      }
      await writeAll(output, cipher.final());
      await writeAll(output, cipher.getAuthTag());
      await output.sync();
    } finally { await source.close(); await output?.close(); }
    await publishPrivate(staging, archive);
    return archive;
  } finally {
    key.fill(0);
    try { if (snapshotDir) await rm(snapshotDir, { recursive: true, force: true }); }
    finally { if (archiveDir) await rm(archiveDir, { recursive: true, force: true }); }
  }
}

export async function decryptBackup(dataDir: string, archive: string, destination: string) {
  if (!archive || !destination) throw Error('Usage: decrypt-backup ARCHIVE DESTINATION');
  dataDir = resolve(dataDir); archive = resolve(archive); destination = resolve(destination);
  await absent(destination);
  const key = await backupKey(dataDir, false, dirname(archive));
  let temporary: string | undefined;
  let source: FileHandle | undefined;
  try {
    source = await open(archive, constants.O_RDONLY | NOFOLLOW);
    const info = await source.stat();
    if (!info.isFile() || info.size < HEADER_BYTES + TAG_BYTES + 16) throw Error('Invalid encrypted backup.');
    const header = Buffer.alloc(HEADER_BYTES), tag = Buffer.alloc(TAG_BYTES);
    await source.read(header, 0, header.length, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC) || header[8] !== 1) throw Error('Unsupported encrypted backup format or version.');
    await source.read(tag, 0, tag.length, info.size - TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(9), { authTagLength: TAG_BYTES });
    decipher.setAAD(header); decipher.setAuthTag(tag);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    temporary = await mkdtemp(join(dirname(destination), '.ff-restore-'));
    const staging = join(temporary, 'restored.sqlite');
    const output = await open(staging, 'wx', 0o600);
    try {
      const buffer = Buffer.alloc(CHUNK_BYTES);
      for (let position = HEADER_BYTES; position < info.size - TAG_BYTES;) {
        const wanted = Math.min(buffer.length, info.size - TAG_BYTES - position);
        const { bytesRead } = await source.read(buffer, 0, wanted, position);
        if (!bytesRead) throw Error('Encrypted backup is truncated.');
        position += bytesRead;
        await writeAll(output, decipher.update(buffer.subarray(0, bytesRead)));
      }
      try { await writeAll(output, decipher.final()); }
      catch { throw Error('Backup authentication failed: the archive is damaged or the encryption key is wrong.'); }
      await output.sync();
    } finally { await output.close(); }
    // Plaintext is published only after the entire archive has authenticated.
    await publishPrivate(staging, destination);
    return destination;
  } finally {
    key.fill(0);
    try { await source?.close(); }
    finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
  }
}
