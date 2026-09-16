-- Subject identifiers, not email addresses, bind Google identities to local clients.
CREATE TABLE google_identities (
 subject TEXT PRIMARY KEY,
 user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Short-lived browser-bound, single-use authorisation transactions. No Google tokens are retained.
CREATE TABLE google_transactions (
 state_hash TEXT PRIMARY KEY,
 browser_hash TEXT NOT NULL,
 nonce_hash TEXT NOT NULL,
 verifier TEXT NOT NULL,
 next_path TEXT NOT NULL,
 expires INTEGER NOT NULL
);
CREATE INDEX google_transactions_expiry ON google_transactions(expires);
