#!/data/data/com.termux/files/usr/bin/bash
# Shared supervisor recovery. Sourcing this file does not start or change a service.
ff_wait_for_supervisor() {
  local ff_service="$1" ff_daemon_output='' ff_daemon_code=0 ff_attempt
  if [ -z "${PREFIX:-}" ] || ! command -v sv >/dev/null 2>&1; then
    echo 'Service control needs Termux and termux-services. Run: pkg install termux-services' >&2
    return 1
  fi
  export SVDIR="$PREFIX/var/service"
  if sv status "$ff_service" >/dev/null 2>&1; then return 0; fi
  if ! command -v service-daemon >/dev/null 2>&1; then
    echo 'The Termux service supervisor is unavailable. Run: pkg install termux-services' >&2
    return 1
  fi
  # An already-running daemon can return nonzero while it discovers a new service.
  # Only start it: restarting the global daemon would interrupt unrelated services.
  ff_daemon_output="$(service-daemon start 2>&1)" || ff_daemon_code=$?
  for ff_attempt in {1..75}; do
    if sv status "$ff_service" >/dev/null 2>&1; then return 0; fi
    if [ "$ff_attempt" = 16 ]; then
      # runsvdir caches the parent directory's whole-second mtime. A service
      # added within that same second can otherwise be missed indefinitely.
      # Request its ordinary rescan without signalling or restarting anything.
      if ! { [ -d "$SVDIR" ] && touch -m "$SVDIR"; }; then
        echo "Could not refresh the service directory timestamp: $SVDIR" >&2
      fi
    fi
    sleep 0.2
  done
  echo "The Termux supervisor did not become ready for $ff_service." >&2
  if [ -n "$ff_daemon_output" ]; then printf '%s\n' "$ff_daemon_output" >&2; fi
  if [ "$ff_daemon_code" -ne 0 ]; then echo "service-daemon start exited with code $ff_daemon_code." >&2; fi
  sv status "$ff_service" >&2 || true
  echo 'Open a new Termux session and retry. No other services were stopped.' >&2
  return 1
}

ff_write_launcher() {
  local ff_launcher="$1" ff_app="$2" ff_config="$3" ff_prefix="$4" ff_tmp
  if [ ! -f "$ff_config/env" ]; then
    echo "Existing app configuration not found: $ff_config/env. Set FF_CONFIG_DIR if it is stored elsewhere." >&2
    return 1
  fi
  if [ -L "$ff_launcher" ]; then
    echo "Refusing to replace a symlink launcher: $ff_launcher" >&2
    return 1
  fi
  mkdir -p "$(dirname "$ff_launcher")" || return
  ff_tmp="$(mktemp "${ff_launcher}.tmp.XXXXXX")" || return 1
  {
    printf '#!%s/bin/bash\nset -euo pipefail\n' "$ff_prefix"
    printf '. %q\ncd %q\n' "$ff_config/env" "$ff_app"
    cat <<'WRAPPER'
case "${1:-status}" in
start|stop|restart|status) exec bash termux/service.sh "${1:-status}" ;;
update) exec bash termux/update.sh ;;
admin) shift; exec node src/manage.ts "$@" ;;
attach) exec python termux/hub-registry.py ;;
detach) exec python termux/hub-registry.py --detach ;;
*) echo 'Usage: form-fire start|stop|restart|status|update|admin|attach|detach'; exit 1 ;;
esac
WRAPPER
  } > "$ff_tmp" || { rm -f "$ff_tmp"; return 1; }
  chmod 700 "$ff_tmp" && mv -f "$ff_tmp" "$ff_launcher" || { rm -f "$ff_tmp"; return 1; }
}

ff_service_main() {
  local ff_action="${1:-status}" ff_app ff_service
  case "$ff_action" in start|stop|restart|status|repair-launcher) ;; *)
    echo 'Usage: bash termux/service.sh start|stop|restart|status|repair-launcher' >&2; return 1;;
  esac
  if [ -z "${PREFIX:-}" ]; then echo 'Run this service command inside Termux. Desktop: npm start.' >&2; return 1; fi
  ff_app="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  ff_service="$PREFIX/var/service/form-fire"
  if [ "$ff_action" = repair-launcher ]; then
    ff_write_launcher "$HOME/.local/bin/form-fire" "$ff_app" "${FF_CONFIG_DIR:-$HOME/.config/form-fire}" "$PREFIX" || return
    echo 'Updated ~/.local/bin/form-fire. Existing configuration and app data were preserved.'
    return
  fi
  if [ ! -x "$ff_service/run" ]; then
    echo "The normal app service is not installed at $ff_service. Install it with bash termux/install.sh." >&2
    echo 'The recording server is separate; use bash termux/record.sh start for a recording.' >&2
    return 1
  fi
  if ! command -v sv >/dev/null 2>&1; then echo 'Run: pkg install termux-services' >&2; return 1; fi
  export SVDIR="$PREFIX/var/service"
  case "$ff_action" in
    start|restart)
      ff_wait_for_supervisor "$ff_service" || return
      sv -w 10 "$ff_action" "$ff_service"
      ;;
    stop) sv -w 10 stop "$ff_service" ;;
    status) sv status "$ff_service" ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then
  set -euo pipefail
  umask 077
  ff_service_main "$@"
fi
