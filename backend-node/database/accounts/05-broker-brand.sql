-- The broker's details printed on paid reports (Premium) are one more kind of saved item.
-- Idempotent: init() applies every file at each start, so the constraint is only replaced when it is the old one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saved_items_kind_check' AND pg_get_constraintdef(oid) LIKE '%broker_brand%'
  ) THEN
    ALTER TABLE saved_items DROP CONSTRAINT IF EXISTS saved_items_kind_check;
    ALTER TABLE saved_items ADD CONSTRAINT saved_items_kind_check CHECK (kind IN ('opportunity_report', 'broker_brand'));
  END IF;
END
$$;
