-- Living Score areas become the wards/communes of the 2025 reorganisation (real boundaries, often MultiPolygon)
-- instead of thirteen illustrative cells around the former district centres.
-- Safe to run on a fresh database too. Reseed afterwards (the slugs change):
--   SEED_RESET=true npm run seed:living

ALTER TABLE areas ALTER COLUMN boundary TYPE geometry(MultiPolygon, 4326) USING ST_Multi(boundary);
