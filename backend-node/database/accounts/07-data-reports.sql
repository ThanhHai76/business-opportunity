-- Reports of wrong figures sent from the pages ("Báo sai số liệu"): about a ward or about a source. Anyone can send one
-- (user_id is set when they were signed in). Idempotent: init() applies every file at each start.
CREATE TABLE IF NOT EXISTS data_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT        NOT NULL CHECK (kind IN ('ward', 'source')),
  target      TEXT        NOT NULL,
  target_name TEXT,
  page        TEXT,
  message     TEXT        NOT NULL,
  contact     TEXT,
  user_id     UUID        REFERENCES app_users(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'checked', 'fixed', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_reports_created_idx ON data_reports (created_at DESC);
