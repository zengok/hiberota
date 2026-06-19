CREATE TABLE IF NOT EXISTS email_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  verification_token_hash TEXT,
  verification_expires_at TEXT,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  consent_text_version TEXT NOT NULL DEFAULT 'kvkk-v1',
  consent_ip TEXT,
  consent_user_agent TEXT,
  preferred_frequency TEXT NOT NULL DEFAULT 'DAILY',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS email_subscribers_status_idx ON email_subscribers(status);
CREATE INDEX IF NOT EXISTS email_subscribers_verification_token_idx ON email_subscribers(verification_token_hash);

CREATE TABLE IF NOT EXISTS subscriber_preferences (
  subscriber_id TEXT NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subscriber_id, preference_type, preference_value)
);

CREATE INDEX IF NOT EXISTS subscriber_preferences_value_idx ON subscriber_preferences(preference_type, preference_value);

CREATE TABLE IF NOT EXISTS email_notifications (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  scheduled_at TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  failed_at TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (subscriber_id, call_id, notification_type)
);

CREATE INDEX IF NOT EXISTS email_notifications_status_idx ON email_notifications(status, scheduled_at);
CREATE INDEX IF NOT EXISTS email_notifications_provider_message_idx ON email_notifications(provider_message_id);

CREATE TABLE IF NOT EXISTS email_delivery_events (
  id TEXT PRIMARY KEY,
  notification_id TEXT REFERENCES email_notifications(id) ON DELETE SET NULL,
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS email_delivery_events_notification_idx ON email_delivery_events(notification_id);

CREATE TABLE IF NOT EXISTS email_digest_queue (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  digest_period TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (subscriber_id, call_id, digest_period)
);

CREATE INDEX IF NOT EXISTS email_digest_queue_period_idx ON email_digest_queue(digest_period, processed_at);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_type, aggregate_id)
);

CREATE INDEX IF NOT EXISTS notification_outbox_status_idx ON notification_outbox(status, available_at);
