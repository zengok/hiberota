BEGIN;

DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS source_crawl_logs;
DROP TABLE IF EXISTS link_health_checks;
DROP TABLE IF EXISTS crawler_jobs;
DROP TABLE IF EXISTS manual_review_queue;
DROP TABLE IF EXISTS call_documents;
DROP TABLE IF EXISTS call_evidence;
DROP TABLE IF EXISTS call_change_logs;
DROP TABLE IF EXISTS call_versions;
DROP TABLE IF EXISTS call_sources;
DROP TABLE IF EXISTS calls;
DROP TABLE IF EXISTS sources;
DROP TABLE IF EXISTS programmes;
DROP TABLE IF EXISTS funders;

COMMIT;
