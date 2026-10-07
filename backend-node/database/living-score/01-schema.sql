-- Hanoi Living Score — PostgreSQL + PostGIS schema.
-- Applied automatically by the postgis container (docker-entrypoint-initdb.d) on first start.
-- For a local Postgres run it once:  psql "$DATABASE_URL" -f backend-node/database/living-score/01-schema.sql
--
-- Rows are computed by the backend seeder from an OpenStreetMap snapshot (© OpenStreetMap contributors, ODbL).
-- Existing databases created from the older sample-data schema: apply 02-osm-data.sql, then reseed with SEED_RESET=true.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS areas (
  id                   SERIAL PRIMARY KEY,
  slug                 TEXT        NOT NULL UNIQUE,
  name                 TEXT        NOT NULL,
  name_en              TEXT        NOT NULL,
  -- accent-stripped, lower-cased "name name_en" used by search
  search_text          TEXT        NOT NULL,
  description          TEXT        NOT NULL,
  description_en       TEXT,
  area_km2             NUMERIC(8,2) NOT NULL CHECK (area_km2 > 0),
  -- [{criterion, text}]: what each score was computed from, in words
  metrics              JSONB       NOT NULL DEFAULT '[]',
  -- raw OSM counts: metroStations[], internationalSchools, cafes, parkPct, busStops
  facts                JSONB       NOT NULL DEFAULT '{}',
  centroid             geometry(Point, 4326)   NOT NULL,
  -- Illustrative outline around a former district centre, NOT an administrative boundary.
  boundary             geometry(Polygon, 4326) NOT NULL,
  data_source          TEXT        NOT NULL DEFAULT 'OpenStreetMap',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS areas_boundary_gix ON areas USING GIST (boundary);
CREATE INDEX IF NOT EXISTS areas_centroid_gix ON areas USING GIST (centroid);

-- One 0-100 score per (area, criterion), relative between the areas. Higher is always better.
CREATE TABLE IF NOT EXISTS area_scores (
  area_id   INTEGER  NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
  criterion TEXT     NOT NULL CHECK (criterion IN
              ('transportation', 'education', 'healthcare', 'greenSpace', 'amenities')),
  score     SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  PRIMARY KEY (area_id, criterion)
);

CREATE TABLE IF NOT EXISTS area_notes (
  id       SERIAL PRIMARY KEY,
  area_id  INTEGER  NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
  kind     TEXT     NOT NULL CHECK (kind IN ('pro', 'con')),
  position SMALLINT NOT NULL DEFAULT 0,
  text     TEXT     NOT NULL,
  text_en  TEXT
);
CREATE INDEX IF NOT EXISTS area_notes_area_idx ON area_notes (area_id);

CREATE TABLE IF NOT EXISTS amenities (
  id          SERIAL PRIMARY KEY,
  area_id     INTEGER      NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
  type        TEXT         NOT NULL CHECK (type IN ('school', 'hospital', 'park', 'shopping')),
  name        TEXT         NOT NULL,
  search_text TEXT         NOT NULL,
  location    geometry(Point, 4326) NOT NULL,
  data_source TEXT         NOT NULL DEFAULT 'OpenStreetMap'
);
CREATE INDEX IF NOT EXISTS amenities_location_gix ON amenities USING GIST (location);
CREATE INDEX IF NOT EXISTS amenities_area_idx ON amenities (area_id);

-- Metro lines/stations: in service and under construction as mapped on OpenStreetMap, planned ones approximate.
CREATE TABLE IF NOT EXISTS infrastructure (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('metro_line', 'metro_station')),
  status      TEXT NOT NULL CHECK (status IN ('operating', 'under_construction', 'planned')),
  geometry    geometry(Geometry, 4326) NOT NULL,
  data_source TEXT NOT NULL DEFAULT 'SAMPLE DATA'
);
CREATE INDEX IF NOT EXISTS infrastructure_geometry_gix ON infrastructure USING GIST (geometry);

-- Knowledge snippets retrieved for the AI recommendation (RAG).
-- Upgrade path: add a pgvector `embedding` column and rank by similarity instead of by topic.
CREATE TABLE IF NOT EXISTS area_knowledge (
  id      SERIAL PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
  topic   TEXT    NOT NULL CHECK (topic IN ('overview', 'transport', 'family', 'lifestyle', 'cost', 'environment')),
  content TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS area_knowledge_area_idx ON area_knowledge (area_id);
