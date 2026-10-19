-- Purchases and paid reports (Hanoi Century Vista). Applied by the server on start after 01-schema.sql (idempotent).
-- Phase 1 sells report credits: a paid order adds credits, each paid report uses one.

CREATE TABLE IF NOT EXISTS billing_orders (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The number the payment provider knows the order by (PayOS: orderCode, a positive integer).
  order_code    BIGINT      GENERATED ALWAYS AS IDENTITY (START WITH 100001) UNIQUE,
  -- Kept for the books when the account is deleted.
  user_id       UUID        REFERENCES app_users (id) ON DELETE SET NULL,
  product       TEXT        NOT NULL CHECK (length(product) <= 40),
  -- Report credits the order adds (0 for an AI pack); see `grants` in 03-ai-premium.sql for everything it adds.
  credits       INTEGER     NOT NULL CHECK (credits >= 0),
  amount_vnd    INTEGER     NOT NULL CHECK (amount_vnd > 0),
  provider      TEXT        NOT NULL CHECK (length(provider) <= 20),
  -- 'expired' is never stored: a pending order past expires_at is shown as expired, and still credited if paid.
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  provider_ref  TEXT        CHECK (length(provider_ref) <= 120),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  paid_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS billing_orders_user_idx ON billing_orders (user_id, created_at DESC);

-- Report credits: + for a paid order, − for each report. The balance is the sum.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  delta       INTEGER     NOT NULL CHECK (delta <> 0),
  reason      TEXT        NOT NULL CHECK (reason IN ('purchase', 'report', 'refund', 'grant')),
  order_id    UUID        REFERENCES billing_orders (id) ON DELETE SET NULL,
  report_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON credit_ledger (user_id);
-- A paid order adds its credits once, however many times the provider repeats its webhook.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_purchase_once ON credit_ledger (order_id) WHERE reason = 'purchase';

-- Paid reports: computed by the server and frozen (inputs, figures, data date), so they can be downloaded again.
CREATE TABLE IF NOT EXISTS paid_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL CHECK (kind IN ('opportunity_feasibility')),
  title       TEXT        NOT NULL CHECK (length(title) <= 200),
  input       JSONB       NOT NULL,
  content     JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paid_reports_user_idx ON paid_reports (user_id, created_at DESC);
