-- In-depth AI questions and Premium (Hanoi Century Vista). Applied by the server on start after 02-billing.sql
-- (idempotent). See src/billing/products.js (what is sold) and src/billing/ai-meter.js (how questions are counted).

-- Premium is active while premium_until is in the future; a purchase extends it from whichever is later, now or the
-- current end.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

-- What an order adds when paid: { "reportCredits": n, "aiCredits": n, "premiumDays": n }, fixed when the order is
-- created. NULL on orders created before this file: those add `credits` report credits, as they always did.
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS grants JSONB;

-- An AI pack or a Premium plan may add no report credit: `credits` (report credits of the order) may now be 0.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'billing_orders'::regclass AND conname = 'billing_orders_credits_check'
      AND pg_get_constraintdef(oid) LIKE '%> 0%'
  ) THEN
    ALTER TABLE billing_orders DROP CONSTRAINT billing_orders_credits_check;
    ALTER TABLE billing_orders ADD CONSTRAINT billing_orders_credits_check CHECK (credits >= 0);
  END IF;
END
$$;

-- One row per in-depth AI answer, and which allowance paid for it. Free and Premium allowances are counted per
-- day (Vietnam time) from this table; a bought credit also has its row in ai_credit_ledger.
CREATE TABLE IF NOT EXISTS ai_usage (
  id        BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   UUID        NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  tool      TEXT        NOT NULL CHECK (length(tool) <= 40),
  source    TEXT        NOT NULL CHECK (source IN ('free', 'premium', 'credit')),
  used_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_idx ON ai_usage (user_id, used_at DESC);

-- Bought AI credits: + for a paid AI pack, − for each question past the daily allowances. The balance is the sum.
CREATE TABLE IF NOT EXISTS ai_credit_ledger (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  delta       INTEGER     NOT NULL CHECK (delta <> 0),
  reason      TEXT        NOT NULL CHECK (reason IN ('purchase', 'use', 'refund', 'grant')),
  order_id    UUID        REFERENCES billing_orders (id) ON DELETE SET NULL,
  usage_id    BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_credit_ledger_user_idx ON ai_credit_ledger (user_id);
-- A paid order adds its AI credits once, however many times the provider repeats its webhook.
CREATE UNIQUE INDEX IF NOT EXISTS ai_credit_ledger_purchase_once ON ai_credit_ledger (order_id) WHERE reason = 'purchase';
