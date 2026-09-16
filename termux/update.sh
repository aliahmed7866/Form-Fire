#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077
FF_APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FF_CONFIG_DIR="${FF_CONFIG_DIR:-$HOME/.config/form-fire}"
. "$FF_CONFIG_DIR/env"
chmod 700 "$FF_CONFIG_DIR" "$FF_DATA_DIR"
chmod 600 "$FF_CONFIG_DIR/env"
cd "$FF_APP_DIR"
if [ -n "$(git status --porcelain)" ]; then echo 'Working tree has changes; update stopped.' >&2; exit 1; fi
FF_PREVIOUS_SHA="$(git rev-parse HEAD)"
node src/manage.ts backup
git fetch origin main
git merge --ff-only origin/main
if ! npm test; then echo "Tests failed. Service was not restarted. Previous commit: $FF_PREVIOUS_SHA" >&2; exit 1; fi
sv restart form-fire
for attempt in 1 2 3 4 5; do
  if node src/healthcheck.ts; then
    echo "Updated to $(git rev-parse --short HEAD)"; exit 0
  fi
  sleep 2
done
echo "Health check failed. Previous commit: $FF_PREVIOUS_SHA. See docs/OPERATIONS.md for recovery." >&2
exit 1
