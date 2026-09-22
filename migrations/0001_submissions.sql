CREATE TABLE IF NOT EXISTS submissions (
 request_id TEXT PRIMARY KEY,
 content_hash TEXT NOT NULL,
 receipt TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','failed')),
 issue_number INTEGER,
 issue_url TEXT,
 created_at INTEGER NOT NULL,
 checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rate_limits (
 bucket TEXT PRIMARY KEY,
 hits INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
