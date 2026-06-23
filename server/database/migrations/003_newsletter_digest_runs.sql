ALTER TABLE email_subscribers ADD COLUMN resend_contact_id TEXT;
ALTER TABLE email_subscribers ADD COLUMN unsubscribe_token_hash TEXT;
ALTER TABLE email_subscribers ADD COLUMN last_resend_contact_synced_at TEXT;

CREATE TABLE IF NOT EXISTS newsletter_runs (
  id TEXT PRIMARY KEY,
  frequency TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  total_subscribers INTEGER NOT NULL DEFAULT 0,
  successful_sends INTEGER NOT NULL DEFAULT 0,
  failed_sends INTEGER NOT NULL DEFAULT 0,
  skipped_sends INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  UNIQUE (frequency, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS newsletter_runs_status_idx ON newsletter_runs(status, started_at);
