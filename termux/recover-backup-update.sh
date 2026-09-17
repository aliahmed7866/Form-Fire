#!/data/data/com.termux/files/usr/bin/bash
# Run from the existing checkout after fetching origin/main. This script may be
# piped from git show so an old updater need not run before getting the fix.
set -euo pipefail
umask 077
cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo 'Working tree has changes; recovery stopped without changing the app.' >&2
  exit 1
fi
FF_TARGET_SHA="$(git rev-parse origin/main)"
git merge-base --is-ancestor HEAD "$FF_TARGET_SHA" || {
  echo 'The checkout has diverged from main; recovery stopped.' >&2; exit 1;
}
FF_CONFIG_DIR="${FF_CONFIG_DIR:-$HOME/.config/form-fire}"
. "$FF_CONFIG_DIR/env"
export FF_DATA_DIR
FF_RECOVERY_DIR="$(mktemp -d "${TMPDIR:-${PREFIX:?Termux PREFIX is required}/tmp}/ff-update-XXXXXXXX")"
trap 'rm -rf -- "$FF_RECOVERY_DIR"' EXIT
git show "$FF_TARGET_SHA:src/backup.ts" > "$FF_RECOVERY_DIR/backup.ts"
# Open the existing database read-only: no migrations before the safety backup.
node --input-type=module - "$FF_RECOVERY_DIR/backup.ts" <<'JS'
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { createEncryptedBackup } = await import(pathToFileURL(process.argv[2]).href);
const dir = process.env.FF_DATA_DIR;
if (!dir) throw Error('FF_DATA_DIR is missing from the private configuration.');
const db = new DatabaseSync(resolve(dir, 'form-fire.sqlite'), { readOnly: true });
try { console.log('Pre-update encrypted backup saved: ' + await createEncryptedBackup(db, dir)); }
finally { db.close(); }
JS
git merge --ff-only "$FF_TARGET_SHA"
# The installed updater now has the fix; retain its normal tests and health check.
bash termux/update.sh
