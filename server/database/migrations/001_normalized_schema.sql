CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS state_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funding_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT,
  source_type TEXT,
  adapter_name TEXT,
  health_status TEXT,
  last_successful_crawl_at TEXT,
  last_failed_crawl_at TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  raw_payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funding_programs (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES funding_sources(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  scope TEXT,
  raw_payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  slug TEXT,
  title TEXT NOT NULL DEFAULT '',
  funder TEXT,
  programme TEXT,
  source_id TEXT,
  status TEXT,
  normalized_status TEXT,
  scope TEXT,
  category TEXT,
  deadline TEXT,
  published_at TEXT,
  budget_min REAL,
  budget_max REAL,
  currency TEXT,
  url TEXT,
  official_url TEXT,
  application_url TEXT,
  confidence_score REAL,
  review_status TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  data TEXT NOT NULL,
  first_detected_at TEXT,
  last_detected_at TEXT,
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_sources (
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  url TEXT,
  content_hash TEXT,
  raw_payload TEXT NOT NULL DEFAULT '{}',
  first_detected_at TEXT,
  last_detected_at TEXT,
  PRIMARY KEY (call_id, source_id)
);

CREATE TABLE IF NOT EXISTS call_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  value TEXT,
  source_url TEXT,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  duration_ms INTEGER,
  found INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crawl_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawl_run_id INTEGER REFERENCES crawl_runs(id) ON DELETE CASCADE,
  source_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_health (
  source_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'healthy',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  average_response_time_ms INTEGER,
  last_http_status INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manual_review_items (
  id TEXT PRIMARY KEY,
  call_id TEXT REFERENCES calls(id) ON DELETE SET NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reasons TEXT NOT NULL DEFAULT '[]',
  payload TEXT NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT REFERENCES calls(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  final_url TEXT,
  duration_ms INTEGER,
  error TEXT,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  source_id TEXT,
  url TEXT,
  priority INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT UNIQUE,
  payload TEXT NOT NULL DEFAULT '{}',
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automation_job_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES automation_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS institution_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_name TEXT NOT NULL,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(institution_name, alias)
);

CREATE INDEX IF NOT EXISTS calls_deadline_idx ON calls(deadline);
CREATE INDEX IF NOT EXISTS calls_status_idx ON calls(status);
CREATE INDEX IF NOT EXISTS calls_scope_idx ON calls(scope);
CREATE INDEX IF NOT EXISTS calls_source_id_idx ON calls(source_id);
CREATE INDEX IF NOT EXISTS calls_content_hash_idx ON calls(content_hash);
CREATE INDEX IF NOT EXISTS calls_is_published_idx ON calls(is_published);
CREATE INDEX IF NOT EXISTS manual_review_items_status_idx ON manual_review_items(status);
CREATE INDEX IF NOT EXISTS automation_jobs_status_available_idx ON automation_jobs(status, available_at, priority);
CREATE INDEX IF NOT EXISTS link_checks_call_checked_idx ON link_checks(call_id, checked_at);
