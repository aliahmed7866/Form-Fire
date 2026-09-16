#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077
FF_APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FF_CONFIG_DIR="${FF_CONFIG_DIR:-$HOME/.config/form-fire}"
FF_DATA_DIR="${FF_DATA_DIR:-$HOME/.local/share/form-fire}"
FF_PORT="${FF_PORT:-8085}"
if [ -z "${PREFIX:-}" ] || ! command -v pkg >/dev/null 2>&1; then
  echo 'Run this installer inside Termux. Desktop: npm start.' >&2
  exit 1
fi
pkg install -y nodejs-lts python git curl termux-services
node -e 'if(Number(process.versions.node.split(".")[0])<24) {console.error("Node 24+ required. Update Termux packages first."); process.exit(1)}; require("node:sqlite")'
mkdir -p "$FF_CONFIG_DIR" "$FF_DATA_DIR" "$HOME/.local/bin"
chmod 700 "$FF_CONFIG_DIR" "$FF_DATA_DIR"
if [ ! -f "$FF_CONFIG_DIR/env" ]; then
  # Quote paths safely for the shell; never overwrite an existing environment.
  python - "$FF_CONFIG_DIR/env" "$FF_DATA_DIR" "$FF_PORT" <<'PY'
import shlex, sys
from pathlib import Path
Path(sys.argv[1]).write_text('\n'.join('export '+k+'='+shlex.quote(v) for k,v in {
 'FF_MODE':'local-test','FF_HOST':'127.0.0.1','FF_PORT':sys.argv[3],
 'FF_DATA_DIR':sys.argv[2], 'FF_ORIGIN':'http://127.0.0.1:'+sys.argv[3]
}.items())+'\n')
PY
fi
chmod 600 "$FF_CONFIG_DIR/env"
. "$FF_CONFIG_DIR/env"
cd "$FF_APP_DIR"
node src/manage.ts backup
npm test
python tests/hub_registry_test.py
FF_SERVICE_DIR="$PREFIX/var/service/form-fire"
mkdir -p "$FF_SERVICE_DIR/log" "$FF_DATA_DIR/logs"
python - "$FF_SERVICE_DIR/run" "$FF_APP_DIR" "$FF_CONFIG_DIR/env" "$PREFIX" <<'PY'
import shlex,sys
from pathlib import Path
p,app,env,prefix=sys.argv[1:]
Path(p).write_text('#!'+prefix+'/bin/bash\nset -e\nexec 2>&1\n. '+shlex.quote(env)+'\ncd '+shlex.quote(app)+'\nexec node src/server.ts\n')
PY
printf '#!%s/bin/sh\nexec svlogd -tt "%s"\n' "$PREFIX" "$FF_DATA_DIR/logs" > "$FF_SERVICE_DIR/log/run"
chmod +x "$FF_SERVICE_DIR/run" "$FF_SERVICE_DIR/log/run"
python - "$HOME/.local/bin/form-fire" "$FF_APP_DIR" "$FF_CONFIG_DIR/env" "$PREFIX" <<'PY'
import shlex,sys
from pathlib import Path
p,app,env,prefix=sys.argv[1:]
Path(p).write_text('#!'+prefix+'/bin/bash\nset -euo pipefail\n. '+shlex.quote(env)+'\ncd '+shlex.quote(app)+'''
case "${1:-status}" in
start) sv up form-fire ;;
stop) sv down form-fire ;;
restart) sv restart form-fire ;;
status) sv status form-fire ;;
update) bash termux/update.sh ;;
admin) shift; node src/manage.ts "$@" ;;
attach) python termux/hub-registry.py ;;
detach) python termux/hub-registry.py --detach ;;
*) echo 'Usage: form-fire start|stop|restart|status|update|admin|attach|detach'; exit 1 ;;
esac
''')
PY
chmod +x "$HOME/.local/bin/form-fire"
# Start the standard Termux service supervisor in the current session if needed.
if [ -f "$PREFIX/etc/profile.d/start-services.sh" ]; then . "$PREFIX/etc/profile.d/start-services.sh"; fi
sv-enable form-fire
for attempt in 1 2 3 4 5; do
  if sv restart form-fire; then break; fi
  sleep 2
done
if [ "${1:-}" = '--with-hub' ]; then python termux/hub-registry.py; fi
for attempt in 1 2 3 4 5; do
  if node src/healthcheck.ts; then
    echo "FORM & FIRE: $FF_ORIGIN"
    echo 'Create your admin: ~/.local/bin/form-fire admin create-admin alex@example.test'
    echo 'Use fictional data. Email, managed identity and hosted payments are not connected.'
    exit 0
  fi
  sleep 2
done
echo 'Service did not pass its health check. Check: sv status form-fire and the private data logs.' >&2
exit 1
