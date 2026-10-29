-- Visit statistics: one counter per day, event and key (a page path with ids folded, a tool, a product).
-- Nothing about a person is stored: no account id, no IP address, no cookie. Idempotent: init() applies every file at each start.
CREATE TABLE IF NOT EXISTS analytics_daily (
  day   DATE    NOT NULL,
  event TEXT    NOT NULL,
  key   TEXT    NOT NULL DEFAULT '',
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, key)
);
