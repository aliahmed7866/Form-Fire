CREATE TABLE contact_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 version INTEGER NOT NULL DEFAULT 0,
 whatsapp_number TEXT NOT NULL DEFAULT '',
 whatsapp_visibility TEXT NOT NULL DEFAULT 'hidden' CHECK(whatsapp_visibility IN ('hidden','clients','public')),
 instagram_handle TEXT NOT NULL DEFAULT '',
 instagram_visibility TEXT NOT NULL DEFAULT 'hidden' CHECK(instagram_visibility IN ('hidden','clients','public')),
 response_note TEXT NOT NULL DEFAULT '',
 updated_at TEXT
);
INSERT INTO contact_settings(id) VALUES(1);
