-- Upgrades a database created from the older sample-data schema to the OpenStreetMap-based one.
-- Safe to run on a fresh database too (every step is conditional). Reseed afterwards:
--   SEED_RESET=true npm run seed:living

ALTER TABLE areas
  DROP COLUMN IF EXISTS population,
  DROP COLUMN IF EXISTS avg_rent_vnd,
  DROP COLUMN IF EXISTS avg_price_per_m2_vnd,
  ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS facts   JSONB NOT NULL DEFAULT '{}';
ALTER TABLE areas ALTER COLUMN data_source SET DEFAULT 'OpenStreetMap';

ALTER TABLE amenities DROP COLUMN IF EXISTS rating;
ALTER TABLE amenities ALTER COLUMN data_source SET DEFAULT 'OpenStreetMap';

-- Safety, environment and cost are no longer scored (no open per-area data).
DELETE FROM area_scores WHERE criterion IN ('safety', 'environment', 'cost');
ALTER TABLE area_scores DROP CONSTRAINT IF EXISTS area_scores_criterion_check;
ALTER TABLE area_scores ADD CONSTRAINT area_scores_criterion_check
  CHECK (criterion IN ('transportation', 'education', 'healthcare', 'greenSpace', 'amenities'));

-- English texts (the API answers in Vietnamese or English, ?lang=en).
ALTER TABLE areas ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE area_notes ADD COLUMN IF NOT EXISTS text_en TEXT;
