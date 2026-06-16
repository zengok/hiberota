-- Hibe Rota automation migration draft.
-- Current local build persists this shape in .hiberota/automation-state.json.
-- Use this reversible schema when moving the automation state to PostgreSQL.

BEGIN;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  list_urls JSONB NOT NULL DEFAULT '[]',
  source_type TEXT NOT NULL,
  crawl_method TEXT NOT NULL,
  country TEXT,
  language TEXT,
  timezone TEXT,
  crawl_frequency_minutes INTEGER NOT NULL DEFAULT 60,
  trust_score INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_javascript BOOLEAN NOT NULL DEFAULT FALSE,
  last_successful_crawl_at TIMESTAMPTZ,
  last_failed_crawl_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  health_status TEXT NOT NULL DEFAULT 'healthy',
  adapter_name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS source_crawl_logs (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT REFERENCES sources(id),
  adapter TEXT,
  operation TEXT NOT NULL,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  found INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_sources (
  call_id TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  official_url TEXT,
  application_url TEXT,
  content_hash TEXT,
  first_detected_at TIMESTAMPTZ,
  last_detected_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  PRIMARY KEY (call_id, source_id)
);

CREATE TABLE IF NOT EXISTS call_versions (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_change_logs (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_url TEXT,
  evidence_text TEXT
);

CREATE TABLE IF NOT EXISTS call_evidence (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT,
  raw_text TEXT,
  source_url TEXT,
  confidence NUMERIC(5, 2),
  page_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_review_queue (
  id TEXT PRIMARY KEY,
  call_id TEXT,
  title TEXT,
  reasons JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS crawler_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  source_id TEXT,
  url TEXT,
  priority INTEGER NOT NULL DEFAULT 5,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 2,
  timeout_ms INTEGER NOT NULL DEFAULT 15000,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS link_health_checks (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  final_url TEXT,
  duration_ms INTEGER,
  error TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS link_health_checks;
-- DROP TABLE IF EXISTS crawler_jobs;
-- DROP TABLE IF EXISTS manual_review_queue;
-- DROP TABLE IF EXISTS call_evidence;
-- DROP TABLE IF EXISTS call_change_logs;
-- DROP TABLE IF EXISTS call_versions;
-- DROP TABLE IF EXISTS call_sources;
-- DROP TABLE IF EXISTS source_crawl_logs;
-- DROP TABLE IF EXISTS sources;
