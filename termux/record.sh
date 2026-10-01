#!/usr/bin/env bash
# Managed, isolated recording service on Termux; explicit foreground mode elsewhere.
set -euo pipefail
umask 077
FF_RECORD_APP="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$FF_RECORD_APP"
command -v node >/dev/null || { echo 'Install Node 24+ in Termux first: pkg install nodejs' >&2; exit 1; }
node -e "if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24 or later is required');require('node:sqlite')"
FF_RECORD_ACTION="${1:-start}"
case "$FF_RECORD_ACTION" in start|fresh|restart|foreground|status|stop|logs) ;; *) echo 'Usage: bash termux/record.sh [start|fresh|restart|foreground|status|stop|logs]' >&2; exit 1;; esac
FF_RECORD_EXPLICIT_PORT="${FF_RECORD_PORT:-}"
FF_RECORD_PORT="$(node --input-type=module -e "import {recordingSettings} from './scripts/record-workspace.ts';console.log(recordingSettings().port)")"
export FF_RECORD_PORT
FF_RECORD_ROOT="$(node --input-type=module -e "import {recordingSettings} from './scripts/record-workspace.ts';console.log(recordingSettings().parent)")"
export FF_RECORD_ROOT
unset FF_RECORD_TAKE FF_RECORD_MANAGED
FF_RECORD_LOG="$FF_RECORD_ROOT/logs/$FF_RECORD_PORT.log"
FF_RECORD_SERVICE="${PREFIX:-}/var/service/form-fire-recording-$FF_RECORD_PORT"
FF_RECORD_OWNED=0
if [ -n "${PREFIX:-}" ] && [ -d "$FF_RECORD_SERVICE" ]; then
  if [ ! -f "$FF_RECORD_SERVICE/owner" ] || [ "$(cat "$FF_RECORD_SERVICE/owner")" != 'FORM-FIRE-RECORDING-SERVICE-v1' ]; then
    echo 'Refusing to manage an unrelated recording service directory.' >&2; exit 1
  fi
  if [ "$(cat "$FF_RECORD_SERVICE/workspace-root")" != "$FF_RECORD_ROOT" ]; then
    echo 'This recording port is managed with a different FF_RECORD_ROOT. Use its original root or another port.' >&2; exit 1
  fi
  FF_RECORD_OWNED=1
  if [ -f "$FF_RECORD_SERVICE/take" ]; then export FF_RECORD_TAKE="$(cat "$FF_RECORD_SERVICE/take")"; fi
fi
show_logs() { if [ -f "$FF_RECORD_LOG" ]; then tail -n 50 "$FF_RECORD_LOG"; else echo 'No managed recording log exists yet.'; fi; }
case "$FF_RECORD_ACTION" in
 logs) show_logs; exit 0 ;;
 status)
  if [ "$FF_RECORD_OWNED" = 1 ] && command -v sv >/dev/null; then sv status "$FF_RECORD_SERVICE" || true; fi
  node scripts/record-status.ts || { show_logs; exit 1; }; exit 0 ;;
 foreground) unset FF_RECORD_TAKE; exec node scripts/record.ts ;;
esac
if [ -z "${PREFIX:-}" ]; then
  if [ "$FF_RECORD_ACTION" = start ] || [ "$FF_RECORD_ACTION" = fresh ]; then
    echo 'No Termux supervisor: using a foreground recording. Keep this terminal open.'
    unset FF_RECORD_TAKE; exec node scripts/record.ts
  fi
  echo 'Managed controls require Termux. Stop a foreground recording with Ctrl+C.' >&2; exit 1
fi
if ! command -v sv >/dev/null 2>&1 || ! command -v service-daemon >/dev/null 2>&1; then
  echo 'Install the recording supervisor once: pkg install termux-services' >&2
  echo 'Then run: bash termux/record.sh start' >&2; exit 1
fi
if [ "$FF_RECORD_ACTION" = stop ]; then
  if [ "$FF_RECORD_OWNED" = 1 ]; then sv -w 10 stop "$FF_RECORD_SERVICE"; fi
  echo 'Managed recording stopped. The saved take is preserved.'; exit 0
fi
export SVDIR="$PREFIX/var/service"
. "$FF_RECORD_APP/termux/service.sh"
if [ "$FF_RECORD_OWNED" = 1 ] && { [ "$FF_RECORD_ACTION" = fresh ] || [ "$FF_RECORD_ACTION" = restart ]; }; then
  ff_wait_for_supervisor "$FF_RECORD_SERVICE"
  sv -w 10 stop "$FF_RECORD_SERVICE"
fi
if [ "$FF_RECORD_OWNED" = 1 ] && [ "$FF_RECORD_ACTION" = start ] && node scripts/record-status.ts >/dev/null 2>&1; then
  node scripts/record-status.ts
else
  if [ "$FF_RECORD_ACTION" = fresh ] || [ -z "${FF_RECORD_TAKE:-}" ]; then
    # Port check happens before seeding. A normal app or old foreground take is never stopped.
    FF_RECORD_AUTO_PORT=0
    if [ -z "$FF_RECORD_EXPLICIT_PORT" ] && [ "$FF_RECORD_ACTION" != restart ]; then FF_RECORD_AUTO_PORT=1; fi
    FF_RECORD_SELECTED_PORT="$(FF_RECORD_AUTO_PORT="$FF_RECORD_AUTO_PORT" node --input-type=module -e "import {chooseRecordingPort} from './scripts/record-workspace.ts';try{console.log(await chooseRecordingPort(process.env.FF_RECORD_AUTO_PORT==='1'))}catch(error){console.error(error.message);process.exit(1)}")"
    if [ "$FF_RECORD_SELECTED_PORT" != "$FF_RECORD_PORT" ]; then
      echo "Port $FF_RECORD_PORT is occupied (EADDRINUSE); starting a fresh recording on $FF_RECORD_SELECTED_PORT. The existing listener is unchanged."
      export FF_RECORD_PORT="$FF_RECORD_SELECTED_PORT"
      FF_RECORD_LOG="$FF_RECORD_ROOT/logs/$FF_RECORD_PORT.log"
      FF_RECORD_SERVICE="$PREFIX/var/service/form-fire-recording-$FF_RECORD_PORT"
      # Check again before preparing a take; do not reuse an existing alternate service.
      if [ -e "$FF_RECORD_SERVICE" ] || [ -L "$FF_RECORD_SERVICE" ]; then
        echo 'The selected recording service appeared during startup. Retry fresh; no new take was created.' >&2; exit 1
      fi
    fi
    FF_RECORD_TAKE="$(node scripts/record.ts prepare)"; export FF_RECORD_TAKE
  else
    node --input-type=module -e "import {loadRecording,assertRecordingPortFree,recordingSettings} from './scripts/record-workspace.ts';loadRecording(process.env.FF_RECORD_TAKE);await assertRecordingPortFree(recordingSettings().port)"
  fi
  mkdir -p "$FF_RECORD_SERVICE" "$FF_RECORD_ROOT/logs"
  chmod 700 "$FF_RECORD_SERVICE" "$FF_RECORD_ROOT/logs"
  # Stay opt-in when Termux's supervisor starts again; 'sv up' still enables this session.
  touch "$FF_RECORD_SERVICE/down"
  printf '%s\n' 'FORM-FIRE-RECORDING-SERVICE-v1' > "$FF_RECORD_SERVICE/owner"
  printf '%s\n' "$FF_RECORD_ROOT" > "$FF_RECORD_SERVICE/workspace-root"
  printf '%s\n' "$FF_RECORD_TAKE" > "$FF_RECORD_SERVICE/take"
  {
    printf '#!%s/bin/bash\nset -euo pipefail\numask 077\n' "$PREFIX"
    printf 'exec >>%q 2>&1\ncd %q\n' "$FF_RECORD_LOG" "$FF_RECORD_APP"
    printf 'export FF_RECORD_ROOT=%q FF_RECORD_PORT=%q FF_RECORD_TAKE=%q FF_RECORD_MANAGED=1\n' "$FF_RECORD_ROOT" "$FF_RECORD_PORT" "$FF_RECORD_TAKE"
    printf 'exec node scripts/record.ts\n'
  } > "$FF_RECORD_SERVICE/run.tmp"
  chmod 700 "$FF_RECORD_SERVICE/run.tmp"; mv "$FF_RECORD_SERVICE/run.tmp" "$FF_RECORD_SERVICE/run"
  {
    printf '#!%s/bin/bash\numask 077\nexec >>%q 2>&1\n' "$PREFIX" "$FF_RECORD_LOG"
    printf 'printf "%%s Recording process exited: code=%%s signal=%%s\\n" "$(date -Iseconds)" "$1" "$2"\n'
    # A killed process can reopen this take. Configuration/startup errors must not loop forever.
    printf 'if [ "$1" != 0 ] && [ "$2" = 0 ]; then sv down .; fi\nsleep 1\n'
  } > "$FF_RECORD_SERVICE/finish.tmp"
  chmod 700 "$FF_RECORD_SERVICE/finish.tmp"; mv "$FF_RECORD_SERVICE/finish.tmp" "$FF_RECORD_SERVICE/finish"
  # Save only after a recoverable take/service exists, so controls also work after a startup failure.
  node --input-type=module -e "import {rememberRecordingPort} from './scripts/record-workspace.ts';rememberRecordingPort()"
  echo "Recording address: http://127.0.0.1:$FF_RECORD_PORT/?record=1"
  if ! ff_wait_for_supervisor "$FF_RECORD_SERVICE"; then
    echo "Retry: cd \"\$HOME/Form-Fire\" && FF_RECORD_PORT=$FF_RECORD_PORT bash termux/record.sh start" >&2
    show_logs; exit 1
  fi
  sv up "$FF_RECORD_SERVICE"
  if ! node scripts/record-status.ts --wait; then show_logs; exit 1; fi
fi
node --input-type=module -e "import {rememberRecordingPort} from './scripts/record-workspace.ts';rememberRecordingPort()"
echo 'Recording runs as a Termux service; this command can return to the prompt.'
echo 'Controls: bash termux/record.sh status | logs | restart | fresh | stop'
echo 'Keep Termux running in Android. Open the URL above, then press Play tour.'
if command -v termux-open-url >/dev/null 2>&1; then termux-open-url "http://127.0.0.1:$FF_RECORD_PORT/?record=1" >/dev/null 2>&1 || true; fi
