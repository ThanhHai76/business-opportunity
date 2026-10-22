-- The career compass keeps a Premium account's answers and 30-day plans (one item per direction) in the account.
-- Idempotent: init() applies every file at each start, so the constraint is only replaced when it lacks the new kinds.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saved_items_kind_check' AND pg_get_constraintdef(oid) LIKE '%career_plan%'
  ) THEN
    ALTER TABLE saved_items DROP CONSTRAINT IF EXISTS saved_items_kind_check;
    ALTER TABLE saved_items ADD CONSTRAINT saved_items_kind_check
      CHECK (kind IN ('opportunity_report', 'broker_brand', 'career_plan', 'career_profile'));
  END IF;
END
$$;
