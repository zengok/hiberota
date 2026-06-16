BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS funders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_tr TEXT,
  official_domains JSONB NOT NULL DEFAULT '[]',
  source_type TEXT,
  region TEXT,
  country TEXT,
  aliases JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programmes (
  id TEXT PRIMARY KEY,
  funder_id TEXT REFERENCES funders(id),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  scope TEXT,
  country TEXT,
  language TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  robots_policy TEXT NOT NULL DEFAULT 'respect',
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 12000,
  last_successful_crawl_at TIMESTAMPTZ,
  last_failed_crawl_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  health_status TEXT NOT NULL DEFAULT 'healthy',
  adapter_name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  external_id TEXT,
  call_code TEXT,
  title TEXT NOT NULL,
  original_title TEXT,
  summary TEXT,
  description TEXT,
  funder_id TEXT REFERENCES funders(id),
  programme_id TEXT REFERENCES programmes(id),
  scope TEXT,
  country TEXT,
  language TEXT,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  publication_date TIMESTAMPTZ,
  opening_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  deadline_timezone TEXT,
  multiple_deadlines JSONB NOT NULL DEFAULT '[]',
  budget_min NUMERIC,
  budget_max NUMERIC,
  currency TEXT,
  funding_rate_min NUMERIC,
  funding_rate_max NUMERIC,
  project_duration_min INTEGER,
  project_duration_max INTEGER,
  trl_min INTEGER,
  trl_max INTEGER,
  target_groups JSONB NOT NULL DEFAULT '[]',
  eligible_countries JSONB NOT NULL DEFAULT '[]',
  eligible_organisation_types JSONB NOT NULL DEFAULT '[]',
  themes JSONB NOT NULL DEFAULT '[]',
  sectors JSONB NOT NULL DEFAULT '[]',
  partnership_required BOOLEAN,
  minimum_partner_count INTEGER,
  official_url TEXT,
  application_url TEXT,
  guide_url TEXT,
  source_confidence NUMERIC(5, 2),
  content_hash TEXT,
  evidence JSONB NOT NULL DEFAULT '{}',
  raw_payload JSONB NOT NULL DEFAULT '{}',
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) STORED,
  first_detected_at TIMESTAMPTZ,
  last_detected_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_sources (
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id),
  official_url TEXT,
  application_url TEXT,
  content_hash TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  first_detected_at TIMESTAMPTZ,
  last_detected_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  PRIMARY KEY (call_id, source_id)
);

CREATE TABLE IF NOT EXISTS call_versions (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_change_logs (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_url TEXT,
  evidence_text TEXT
);

CREATE TABLE IF NOT EXISTS call_evidence (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  value TEXT,
  raw_text TEXT,
  source_url TEXT,
  document_name TEXT,
  page_number INTEGER,
  confidence NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_documents (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT,
  mime_type TEXT,
  file_hash TEXT,
  parsed_status TEXT NOT NULL DEFAULT 'pending',
  raw_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_review_queue (
  id TEXT PRIMARY KEY,
  call_id TEXT REFERENCES calls(id) ON DELETE SET NULL,
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
  source_id TEXT REFERENCES sources(id),
  url TEXT,
  priority INTEGER NOT NULL DEFAULT 5,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 15000,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  error_code TEXT,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS link_health_checks (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT REFERENCES calls(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  final_url TEXT,
  duration_ms INTEGER,
  error TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_email TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calls_deadline_idx ON calls(deadline);
CREATE INDEX IF NOT EXISTS calls_status_idx ON calls(status);
CREATE INDEX IF NOT EXISTS calls_scope_idx ON calls(scope);
CREATE INDEX IF NOT EXISTS calls_funder_id_idx ON calls(funder_id);
CREATE INDEX IF NOT EXISTS calls_programme_id_idx ON calls(programme_id);
CREATE INDEX IF NOT EXISTS calls_country_idx ON calls(country);
CREATE INDEX IF NOT EXISTS calls_publication_date_idx ON calls(publication_date);
CREATE INDEX IF NOT EXISTS calls_content_hash_idx ON calls(content_hash);
CREATE INDEX IF NOT EXISTS calls_external_id_idx ON calls(external_id);
CREATE INDEX IF NOT EXISTS calls_call_code_idx ON calls(call_code);
CREATE INDEX IF NOT EXISTS calls_slug_idx ON calls(slug);
CREATE INDEX IF NOT EXISTS calls_search_vector_idx ON calls USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS calls_title_trgm_idx ON calls USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crawler_jobs_status_available_idx ON crawler_jobs(status, available_at, priority);

COMMIT;
