-- Verified email, accepted terms, and the one-time links sent by email (verify an address, reset a password).
-- Idempotent; applied after 03-ai-premium.sql.

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified_at  TIMESTAMPTZ;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS terms_accepted_at  TIMESTAMPTZ;

-- Like sessions, only the SHA-256 of the token is kept: a leaked table cannot be used to reset anyone's password.
-- At most one live token per user and purpose (a new request replaces the older one); a token works once.
CREATE TABLE IF NOT EXISTS app_email_tokens (
  token_hash  TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  purpose     TEXT        NOT NULL CHECK (purpose IN ('verify', 'reset')),
  email       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS app_email_tokens_user_idx ON app_email_tokens (user_id, purpose);
