# Security model for the local test app

## One sign-in, server-owned roles

Everyone uses **Your space → Sign in**. The local test server validates the account password. Email verification and administrator TOTP are disabled by default at the owner’s request. Set `FF_REQUIRE_VERIFICATION=1` to test both gates again; stored verification state and authenticator secrets are preserved. Session hashes are scoped to the active policy, so password-only sessions cannot be reused in strict mode. A successful admin session opens the admin tools. Ordinary registration always creates a client, and Google sign-in cannot create or enter an admin account. Public navigation contains no admin or setup links.

A hidden URL is not an access control. Every admin API still checks the authenticated role on the server; client records also check ownership. Changing a URL, form field, role property or browser script cannot grant server access. Setup pages contain instructions only and appear after an admin session; credentials and test-code commands have no public API.

## Protection in this release

- SQL uses prepared statements with bound values. The few dynamic table/column names come from fixed internal lists, never request input. Tests include SQL-shaped credentials, names and record identifiers, and attempted client role escalation.
- Passwords use random salts and versioned scrypt hashes with N=16384, r=8, p=5. Legacy hashes still work and are upgraded only after full successful authentication, including admin TOTP. Passwords are hashed, not reversibly encrypted.
- Sessions use random tokens, stored as hashes, with HttpOnly/SameSite cookies, expiration and CSRF checks. Each request re-reads the role from the database. Password reset revokes previous sessions.
- Host and mutation Origin must match the configured origin. JSON content types are checked exactly. Request bodies are limited to 64 KiB; headers and timeouts are bounded. Login/recovery/provider rate limits remain in place.
- Content Security Policy blocks inline/third-party scripts, framing and plugins. HTML escapes user content. Camera, microphone and geolocation are disabled by Permissions Policy.
- Data/config directories are private; database, WAL/SHM sidecars, key files and backups use owner-only permissions. These permissions are not encryption.

## Encryption: what is and is not covered

**New backups are encrypted by default** with AES-256-GCM, a random nonce per archive and authenticated version/header data. The `.ffbackup` archive does not contain its encryption key. Restore rejects tampering or the wrong key and will not overwrite an existing destination. Private temporary SQLite snapshots are removed when the operation finishes or throws; an abrupt process/device failure can leave a private temporary folder to review.

The key defaults to `FF_DATA_DIR/backup.key`, separate from the database and archives. `backup-key-id` detects accidental key replacement. Preserve the original key securely and separately from off-device archives: losing it makes those archives unrecoverable. `FF_BACKUP_KEY_FILE` can select another owner-only key file in a private directory. Encryption cannot protect against an attacker who can read both the device's data and its key. Old plaintext `.sqlite` backups are kept until the owner deliberately removes them.

**The live SQLite database is not encrypted by this app.** Profiles, notes, authenticator secrets and the local test outbox remain readable to the operating-system account that owns the database. Device storage encryption and a protected Termux account are separate controls. This release continues to refuse production mode and non-loopback origins/bind addresses; use fictional records until an independently reviewed production data/identity deployment is configured.

**Default phone traffic stays on loopback HTTP (`127.0.0.1:8085`).** It is not TLS-encrypted. It does not traverse Wi-Fi or the internet, but other software with access to this device remains in the threat model. Public HTTP hosting and reverse-proxy/tunnel deployment are unsupported. HTTPS can be enabled with a certificate trusted by the phone; it uses TLS 1.2 or newer and Secure cookies. Choosing HTTPS without valid certificate/key configuration fails startup, rather than falling back to HTTP.

## Backup publication on Termux

Backup keys, archives and authenticated restore exports first try atomic hard-link publication. If the filesystem denies hard links (`EACCES`, `EPERM`) or does not support them, publication uses an exclusive owner-only copy (`wx`, mode 600), then synchronises the file. Existing files and symlinks are never overwritten. This follows [Node’s exclusive file-open semantics](https://nodejs.org/docs/latest-v24.x/api/fs.html#file-system-flags).

The fallback is not atomic: another process can observe an incomplete file during copying. Invalid keys and unauthenticated archives fail closed; retry after the other backup operation completes. Handled write failures remove only the destination created by that operation. A device crash can leave an incomplete file; do not delete or regenerate encryption keys to work around it. Preserve the original key and investigate before recovery. Restore publication still begins only after the complete archive has authenticated. The encrypted archive format is unchanged.

## Optional HTTPS on the device

Obtain a certificate and private key for the exact loopback hostname/IP that your browser trusts. Do not use the repository's test fixtures or bypass browser certificate warnings. Store the key privately outside the source checkout, with mode 600. Set these exports in `~/.config/form-fire/env` using the actual certificate paths:

```bash
export FF_ORIGIN='https://127.0.0.1:8085'
export FF_TLS_CERT_FILE='/absolute/private/path/loopback-cert.pem'
export FF_TLS_KEY_FILE='/absolute/private/path/loopback-key.pem'
# If the certificate is issued by a private CA, provide its certificate for health checks:
export FF_TLS_CA_FILE='/absolute/private/path/ca-cert.pem'
```

Restart, then open that exact HTTPS origin. The health check verifies certificates and does not have an insecure fallback. Reattach the Admin Hub tile with `~/.local/bin/form-fire attach` if used; the hub also needs to trust your certificate issuer. Change the Google authorised callback to the exact new HTTPS origin if Google is connected. Local HSTS is intentionally absent: hostname-wide HSTS can otherwise break other HTTP apps on the same device.

The normal local test installation needs none of these certificate changes. If certificate configuration is not available, retain the loopback-only boundary instead of exposing HTTP to a network.

## Connection errors

A browser “Failed to fetch” is a transport failure; it does not establish an authentication error. The app now preserves entered sign-in values and shows a local recovery message. Page-load retry repeats reads only; login and other writes are never retried automatically.

On the device:

```bash
~/.local/bin/form-fire status
~/.local/bin/form-fire restart
```

Then reopen the exact configured origin. Android may have stopped Termux; a wrong port, mismatched HTTP/HTTPS setting or an untrusted certificate can also prevent connection. If it continues, inspect the private service log locally. Never post passwords, OTPs, key files or full configuration contents.

## References and limits

The implementation follows the relevant [OWASP SQL injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html), [scrypt profiles](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt), [authenticated storage encryption guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html), and [Node HTTPS API](https://nodejs.org/docs/latest-v24.x/api/https.html). Automated tests and source review are not a penetration-test certification. Real phone/browser verification, production hosting, managed identity, encrypted live storage and operational security remain separate launch work.
