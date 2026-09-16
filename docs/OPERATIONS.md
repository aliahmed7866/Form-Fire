# Installation, updates and recovery

## Independent directories

| Item | Termux default |
|---|---|
| Source checkout | `~/Form-Fire` |
| Private configuration | `~/.config/form-fire/env` |
| Database | `~/.local/share/form-fire/form-fire.sqlite` |
| Encrypted backups | `~/.local/share/form-fire/backups/*.ffbackup` |
| Backup key and fingerprint | `~/.local/share/form-fire/backup.key` and `backup-key-id` |
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

Uses SQLite's online backup API, including committed WAL data, then writes an authenticated AES-256-GCM `.ffbackup` archive. The private temporary snapshot is removed on completion or handled failure. Back up with this command rather than copying an open SQLite file. An explicit destination must end in `.ffbackup`; an existing file is never overwritten.

The first backup creates a random owner-only key at `FF_DATA_DIR/backup.key`, separate from the archives, and a `backup-key-id` fingerprint. Preserve the key securely and separately from off-device archives: it is required for restore and cannot be regenerated. Missing/replaced/insecure keys fail safely. Optionally configure `FF_BACKUP_KEY_FILE` in an existing private directory. No off-device key/backup service is configured.

Older `.sqlite` backups are plaintext and remain untouched. The first update from an older release can still make a plaintext pre-update backup using the old script. Create a new encrypted backup after upgrading; review and deliberately remove obsolete plaintext copies only once your recovery copy is verified. The live SQLite database remains unencrypted by the app; see [security scope](SECURITY.md).

## Restore

Stop the service first. Keep a backup of the current database for rollback. Use a backup from the compatible schema version.

```bash
~/.local/bin/form-fire stop
```

1. Read `FF_DATA_DIR` from `~/.config/form-fire/env`.
2. Move the stopped database plus any `-wal` and `-shm` sidecars to a recovery folder; do not leave stale sidecars beside the replacement.
3. For a new encrypted archive, use `~/.local/bin/form-fire admin decrypt-backup /absolute/path/backup.ffbackup /absolute/private/path/restored.sqlite`. The original key must be available in the configured key location. This command does not open the live database, authenticates before publishing output and refuses to overwrite any destination. Move the resulting SQLite file into `FF_DATA_DIR/form-fire.sqlite`, with no stale sidecars present. For a legacy plaintext backup, copy it directly instead. Keep permissions at 600.
4. Start with `~/.local/bin/form-fire start`.
5. Check `/health`, sign in, and confirm expected requests and plans. The backup includes sessions; after a security incident revoke sessions before restarting. Delete any extra decrypted restore copy once it is no longer needed.

For example, after checking your paths, use a stopped SQLite database and `PRAGMA integrity_check` to validate the restored copy. Tests exercise reopening persistent records; full phone restore drills remain on the testing checklist.

## Updating

`form-fire update` refuses dirty working trees, creates an encrypted backup, fetches origin/main, fast-forwards only, runs integration tests and restarts the service. A failed test leaves the previous process running; its source directory may contain the newly fetched files, so resolve the failed update before any restart. A failed health check reports the previous commit for recovery. There is no forced reset or automatic destructive rollback.

To recover a code update, stop the service, create a separate checkout at the reported previous commit (or deliberately restore the previous checkout), pair it with a compatible database backup if a schema changed, then rerun installation. Preserve the failing checkout and backup until recovery is verified. Automatic updates are intentionally not enabled.

## Hub compatibility and detachment

The registry entry uses the existing AYCF Admin Hub `service`, `port`, `health_url`, `open_url` and `install_command` contract, inspected at AYCF commit `56aff3b33a1fd471e9af884f470f95f6981a0dda`. The entry controls the independent `form-fire` runit service. The installer has no dependency on AYCF imports, database or login.

The registry utility preserves other apps and unrelated top-level fields, writes atomically, checks registered port collisions and makes a `.before-form-fire` backup. Repeated attaches do not duplicate the entry. Attach while no other registry maintenance command is running. Default AYCF registry merging preserves additional installed entries; if you replace that file manually, run `form-fire attach` again.

`form-fire detach` removes only the tile and its hub controls. It keeps the app running and all data intact. For a later production move, use the independent repo and migrate the app data with an explicit schema/identity mapping; managed-auth migration is not yet implemented.

## Network boundary

Local-test mode permits loopback binding and origins only, validates Host/Origin (including health checks), and uses HttpOnly SameSite=Strict session cookies plus CSRF checks. Open the exact configured origin (default `127.0.0.1`, not `localhost`). The default remains local HTTP on port 8085. Native HTTPS is available with trusted certificate/key configuration, enables Secure cookies, and refuses HTTP fallback; see [HTTPS setup and security limits](SECURITY.md). Standalone configuration rejects mismatched origin/listen ports or IPv4/IPv6 addresses. Health checks respect HTTP/HTTPS and verify certificates. Do not publish this mode through a tunnel or reverse proxy. Production requires a separate reviewed deployment and the launch gates in DECISIONS.md.

## Optional Google connection

Add `FF_GOOGLE_CLIENT_ID` and `FF_GOOGLE_CLIENT_SECRET` as private exports in the existing Termux environment file, then restart. The configuration file is outside the checkout and survives updates. See [Google sign-in setup](GOOGLE_SIGN_IN.md). A separate short-lived HttpOnly SameSite=Lax cookie supports the provider callback; the main app session remains SameSite=Strict. Google identity mappings are included in database backups and cascade on client deletion; transient authorisation records expire after ten minutes. No provider access/refresh/ID tokens are retained.

## Browser cannot connect

If the app reports a connection failure, check `~/.local/bin/form-fire status`, then `~/.local/bin/form-fire restart` and refresh the exact configured URL. The new Retry button repeats only page reads. It never retries sign-in or writes automatically. Android background-process termination, wrong ports, HTTP/HTTPS mismatches and untrusted certificates can cause transport failures; the screenshot alone cannot identify which occurred. Inspect private logs on the device if restart does not resolve it.
