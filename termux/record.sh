#!/usr/bin/env bash
# Fresh fictional screen-recording workspace; never seeds or resets an existing app.
set -euo pipefail
umask 077
FF_RECORD_APP="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FF_RECORD_APP"
command -v node >/dev/null || { echo 'Install Node 24+ in Termux first: pkg install nodejs' >&2; exit 1; }
node -e "if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or later is required');require('node:sqlite')"
case "${1:-start}" in
 start|foreground) exec node scripts/record.ts ;;
 status) exec node scripts/record-status.ts ;;
 *) echo 'Usage: bash termux/record.sh [start|status]' >&2; exit 1 ;;
esac
