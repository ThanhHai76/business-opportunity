-- Accounts and saved items (Hanoi 100 Years). Applied by the server on start (idempotent), so it also works on
-- managed PostgreSQL (Supabase, Neon, RDS…) where /docker-entrypoint-initdb.d is not available. PostgreSQL 13+.

CREATE TABLE IF NOT EXISTS app_users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL CHECK (length(email) <= 254),
  -- scrypt$N$r$p$salt$hash (base64url), see src/accounts/passwords.js
  password_hash  TEXT        NOT NULL,
  display_name   TEXT        CHECK (length(display_name) <= 80),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);
-- One account per address, whatever its case.
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_key ON app_users (lower(email));

-- Server-side sessions: the browser holds a random token in an HttpOnly cookie, the table only its SHA-256.
CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash    TEXT        PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  user_agent    TEXT        CHECK (length(user_agent) <= 300)
);
CREATE INDEX IF NOT EXISTS app_sessions_user_idx ON app_sessions (user_id);
CREATE INDEX IF NOT EXISTS app_sessions_expires_idx ON app_sessions (expires_at);

-- What a user keeps: one row per item, the item itself as JSON. `kind` says what it is; `item_key` makes the same
-- thing saved twice replace the older copy (for a report: business type | ward | horizon).
CREATE TABLE IF NOT EXISTS saved_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL CHECK (kind IN ('opportunity_report')),
  item_key    TEXT        NOT NULL CHECK (length(item_key) <= 200),
  payload     JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, item_key)
);
CREATE INDEX IF NOT EXISTS saved_items_user_kind_idx ON saved_items (user_id, kind, updated_at DESC);
