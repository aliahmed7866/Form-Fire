CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client','admin')),
 verified INTEGER NOT NULL DEFAULT 0, totp_secret TEXT, profile TEXT NOT NULL DEFAULT '{}',
 admin_notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, token TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS services (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('train','eat','both','chef')),
 description TEXT NOT NULL, inclusions TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0,
 price_minor INTEGER CHECK(price_minor >= 0), currency TEXT NOT NULL DEFAULT 'GBP'
);
CREATE TABLE IF NOT EXISTS requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), service_id TEXT NOT NULL REFERENCES services(id),
 kind TEXT NOT NULL CHECK(kind IN ('coaching','chef')), details TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'submitted', package TEXT, active INTEGER NOT NULL DEFAULT 0,
 booking_status TEXT NOT NULL DEFAULT 'enquiry', proposal TEXT, accepted_at TEXT,
 idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS replies (id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id), author_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS request_events (id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id), actor_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS recipes (id TEXT PRIMARY KEY, title TEXT NOT NULL, ingredients TEXT NOT NULL, portions TEXT NOT NULL, preparation TEXT NOT NULL, substitutions TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('training','meal')), content TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL REFERENCES requests(id), template_id TEXT NOT NULL REFERENCES templates(id), template_version INTEGER NOT NULL, version INTEGER NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS checkins (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), week TEXT NOT NULL, progress TEXT NOT NULL, energy INTEGER NOT NULL CHECK(energy BETWEEN 1 AND 5), notes TEXT NOT NULL, measurements TEXT NOT NULL DEFAULT '', feedback TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,week));
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL REFERENCES requests(id), description TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor>0), currency TEXT NOT NULL, price_snapshot TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id), kind TEXT NOT NULL CHECK(kind IN ('payment','refund')), amount_minor INTEGER NOT NULL CHECK(amount_minor>0), source TEXT NOT NULL DEFAULT 'manual', event_key TEXT NOT NULL UNIQUE, reference TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS account_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL CHECK(kind IN ('deletion')), status TEXT NOT NULL DEFAULT 'requested', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS requests_owner ON requests(user_id);
CREATE INDEX IF NOT EXISTS assignments_owner ON assignments(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
