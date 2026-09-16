# Installation, updates and recovery

## Independent directories

| Item | Termux default |
|---|---|
| Source checkout | `~/Form-Fire` |
| Private configuration | `~/.config/form-fire/env` |
| Database | `~/.local/share/form-fire/form-fire.sqlite` |
| Backups | `~/.local/share/form-fire/backups/` |
| Logs | `~/.local/share/form-fire/logs/` |
| Service | `$PREFIX/var/service/form-fire` |
| App | `http://127.0.0.1:8085` |
| Existing hub registry | `~/.config/aycf/apps.json` |

Database and config directories use owner-only permissions. The SQLite file, backups and generated environment are private. Installer reruns preserve existing environment and data. The API does not log request bodies or credentials. The local outbox contains sensitive short-lived test codes and should be treated as private data.

Node 24+ with `node:sqlite` is required. The installer's preflight fails explicitly if unsupported. This was tested under Linux, not on a physical Android device. Android battery management can stop Termux; allow Termux background operation if required. `termux-wake-lock` is an optional device choice. No Android startup or battery settings are silently changed.

## Backup

```bash
~/.local/bin/form-fire admin backup
```

Uses SQLite's online backup API, including committed WAL data. Back up the database with this command rather than copying an open database file. Copy backups and the private environment to a trusted encrypted destination you control. No off-device backup service is configured. Check available storage and periodically prune obsolete fictional-test backups.

## Restore

Stop the service first. Keep a backup of the current database for rollback. Use a backup from the compatible schema version.

```bash
~/.local/bin/form-fire stop
```

1. Read `FF_DATA_DIR` from `~/.config/form-fire/env`.
2. Move the stopped database plus any `-wal` and `-shm` sidecars to a recovery folder; do not leave stale sidecars beside the replacement.
3. Copy the selected backup to `FF_DATA_DIR/form-fire.sqlite` and set its permissions to 600.
4. Start with `~/.local/bin/form-fire start`.
5. Check `/health`, sign in, and confirm expected requests and plans. The backup includes sessions; after a security incident revoke sessions before restarting.

For example, after checking your paths, use a stopped SQLite database and `PRAGMA integrity_check` to validate the restored copy. Tests exercise reopening persistent records; full phone restore drills remain on the testing checklist.

## Updating

`form-fire update` refuses dirty working trees, creates a backup, fetches origin/main, fast-forwards only, runs integration tests and restarts the service. A failed test leaves the previous process running; its source directory may contain the newly fetched files, so resolve the failed update before any restart. A failed health check reports the previous commit for recovery. There is no forced reset or automatic destructive rollback.

To recover a code update, stop the service, create a separate checkout at the reported previous commit (or deliberately restore the previous checkout), pair it with a compatible database backup if a schema changed, then rerun installation. Preserve the failing checkout and backup until recovery is verified. Automatic updates are intentionally not enabled.

## Hub compatibility and detachment

The registry entry uses the existing AYCF Admin Hub `service`, `port`, `health_url`, `open_url` and `install_command` contract, inspected at AYCF commit `56aff3b33a1fd471e9af884f470f95f6981a0dda`. The entry controls the independent `form-fire` runit service. The installer has no dependency on AYCF imports, database or login.

The registry utility preserves other apps and unrelated top-level fields, writes atomically, checks registered port collisions and makes a `.before-form-fire` backup. Repeated attaches do not duplicate the entry. Attach while no other registry maintenance command is running. Default AYCF registry merging preserves additional installed entries; if you replace that file manually, run `form-fire attach` again.

`form-fire detach` removes only the tile and its hub controls. It keeps the app running and all data intact. For a later production move, use the independent repo and migrate the app data with an explicit schema/identity mapping; managed-auth migration is not yet implemented.

## Network boundary

Local-test mode permits loopback binding only, validates Host/Origin and uses an HttpOnly SameSite=Strict session cookie plus CSRF checks. Open the exact configured origin (default `127.0.0.1`, not `localhost`). Do not publish this mode through a tunnel or reverse proxy. Production requires managed identity, administrator MFA, secure HTTPS sessions, reviewed policies and the other launch gates in DECISIONS.md.
