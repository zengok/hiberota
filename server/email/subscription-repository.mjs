import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { createSqliteAutomationRepository } from "../database/sqlite-repository.mjs";
import { normalizeEmail, SUBSCRIBER_STATUSES } from "./subscription-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function dbPath(options = {}) {
  return path.resolve(options.databasePath || process.env.DATABASE_PATH || process.env.SQLITE_DATABASE_PATH || path.join(root, ".hiberota", "database.sqlite"));
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function createSubscriptionRepository(options = {}) {
  const databasePath = dbPath(options);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  createSqliteAutomationRepository({ databasePath }).close();
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  const upsertSubscriber = db.prepare(`
    INSERT INTO email_subscribers (
      id, email, email_normalized, status, verification_token_hash, verification_expires_at,
      consent_text_version, consent_ip, consent_user_agent, preferred_frequency, created_at, updated_at
    )
    VALUES (@id, @email, @email_normalized, @status, @verification_token_hash, @verification_expires_at,
      @consent_text_version, @consent_ip, @consent_user_agent, @preferred_frequency, @now, @now)
    ON CONFLICT(email_normalized) DO UPDATE SET
      email = excluded.email,
      verification_token_hash = CASE WHEN email_subscribers.status = 'ACTIVE' THEN email_subscribers.verification_token_hash ELSE excluded.verification_token_hash END,
      verification_expires_at = CASE WHEN email_subscribers.status = 'ACTIVE' THEN email_subscribers.verification_expires_at ELSE excluded.verification_expires_at END,
      consent_text_version = excluded.consent_text_version,
      consent_ip = excluded.consent_ip,
      consent_user_agent = excluded.consent_user_agent,
      preferred_frequency = excluded.preferred_frequency,
      updated_at = excluded.updated_at
  `);
  const setPref = db.prepare("INSERT OR IGNORE INTO subscriber_preferences (subscriber_id, preference_type, preference_value) VALUES (?, ?, ?)");
  const deletePrefs = db.prepare("DELETE FROM subscriber_preferences WHERE subscriber_id = ?");

  function preferencesFor(subscriberId) {
    return db.prepare("SELECT preference_type, preference_value FROM subscriber_preferences WHERE subscriber_id = ? ORDER BY preference_type, preference_value").all(subscriberId);
  }

  return {
    databasePath,
    subscribe({ email, verificationTokenHash, verificationExpiresAt, consentIp, consentUserAgent, frequency = "DAILY", interests = [], consentTextVersion = "kvkk-v1" }) {
      const normalized = normalizeEmail(email);
      const existing = db.prepare("SELECT id, status FROM email_subscribers WHERE email_normalized = ?").get(normalized);
      const subscriberId = existing?.id || id("sub");
      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        upsertSubscriber.run({
          id: subscriberId,
          email: email.trim(),
          email_normalized: normalized,
          status: existing?.status || SUBSCRIBER_STATUSES.PENDING,
          verification_token_hash: verificationTokenHash,
          verification_expires_at: verificationExpiresAt,
          consent_text_version: consentTextVersion,
          consent_ip: consentIp || "",
          consent_user_agent: consentUserAgent || "",
          preferred_frequency: frequency,
          now,
        });
        deletePrefs.run(subscriberId);
        for (const interest of interests) setPref.run(subscriberId, "interest", interest);
        this.enqueueOutbox("SEND_VERIFICATION_EMAIL", subscriberId, { subscriberId }, now);
      });
      tx();
      return this.findSubscriberById(subscriberId);
    },
    findSubscriberById(subscriberId) {
      const row = db.prepare("SELECT * FROM email_subscribers WHERE id = ?").get(subscriberId);
      return row ? { ...row, preferences: preferencesFor(row.id) } : null;
    },
    findByVerificationHash(hash) {
      const row = db.prepare("SELECT * FROM email_subscribers WHERE verification_token_hash = ?").get(hash);
      return row ? { ...row, preferences: preferencesFor(row.id) } : null;
    },
    confirmSubscriber(subscriberId) {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE email_subscribers
        SET status = 'ACTIVE', confirmed_at = COALESCE(confirmed_at, ?), verification_token_hash = NULL,
          verification_expires_at = NULL, updated_at = ?
        WHERE id = ? AND status != 'UNSUBSCRIBED'
      `).run(now, now, subscriberId);
      return this.findSubscriberById(subscriberId);
    },
    updateVerification(subscriberId, hash, expiresAt) {
      db.prepare(`
        UPDATE email_subscribers
        SET verification_token_hash = ?, verification_expires_at = ?, updated_at = ?
        WHERE id = ? AND status != 'ACTIVE'
      `).run(hash, expiresAt, new Date().toISOString(), subscriberId);
      this.enqueueOutbox("SEND_VERIFICATION_EMAIL", subscriberId, { subscriberId });
    },
    unsubscribe(subscriberId) {
      const now = new Date().toISOString();
      db.prepare("UPDATE email_subscribers SET status = 'UNSUBSCRIBED', unsubscribed_at = ?, updated_at = ? WHERE id = ?").run(now, now, subscriberId);
      db.prepare("UPDATE email_notifications SET status = 'CANCELLED', updated_at = ? WHERE subscriber_id = ? AND status IN ('PENDING', 'QUEUED')").run(now, subscriberId);
      return this.findSubscriberById(subscriberId);
    },
    updateResendContact(subscriberId, { contactId = "" } = {}) {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE email_subscribers
        SET resend_contact_id = COALESCE(NULLIF(?, ''), resend_contact_id),
          last_resend_contact_synced_at = ?, updated_at = ?
        WHERE id = ?
      `).run(contactId, now, now, subscriberId);
      return this.findSubscriberById(subscriberId);
    },
    updatePreferences(subscriberId, { frequency, interests = [] }) {
      const tx = db.transaction(() => {
        db.prepare("UPDATE email_subscribers SET preferred_frequency = ?, updated_at = ? WHERE id = ?").run(frequency, new Date().toISOString(), subscriberId);
        deletePrefs.run(subscriberId);
        for (const interest of interests) setPref.run(subscriberId, "interest", interest);
      });
      tx();
      return this.findSubscriberById(subscriberId);
    },
    activeSubscribers() {
      return db.prepare("SELECT * FROM email_subscribers WHERE status = 'ACTIVE'").all().map((row) => ({ ...row, preferences: preferencesFor(row.id) }));
    },
    listPublishedCalls() {
      return db.prepare(`
        SELECT id, data, deadline, published_at, first_detected_at, updated_at
        FROM calls
        WHERE is_published = 1
        ORDER BY deadline IS NULL, deadline ASC, updated_at DESC
      `).all().map((row) => {
        const call = parseJson(row.data, {});
        return {
          ...call,
          id: call.id || row.id,
          deadline: call.deadline || row.deadline,
          publishedAt: call.publishedAt || row.published_at,
          firstDetectedAt: call.firstDetectedAt || row.first_detected_at,
          updatedAt: call.updatedAt || row.updated_at,
        };
      });
    },
    enqueueOutbox(eventType, aggregateId, payload, availableAt = new Date().toISOString()) {
      const outboxId = id("outbox");
      db.prepare(`
        INSERT OR IGNORE INTO notification_outbox (id, event_type, aggregate_id, payload_json, status, available_at)
        VALUES (?, ?, ?, ?, 'PENDING', ?)
      `).run(outboxId, eventType, aggregateId, json(payload), availableAt);
      return outboxId;
    },
    createNotification({ subscriberId, callId, type, scheduledAt = null, status = "PENDING" }) {
      const notificationId = id("notif");
      db.prepare(`
        INSERT OR IGNORE INTO email_notifications (id, subscriber_id, call_id, notification_type, status, scheduled_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(notificationId, subscriberId, callId, type, status, scheduledAt);
      return db.prepare("SELECT * FROM email_notifications WHERE subscriber_id = ? AND call_id = ? AND notification_type = ?").get(subscriberId, callId, type);
    },
    enqueueDigest({ subscriberId, callId, period }) {
      db.prepare("INSERT OR IGNORE INTO email_digest_queue (id, subscriber_id, call_id, digest_period) VALUES (?, ?, ?, ?)").run(id("digest"), subscriberId, callId, period);
    },
    getDigestBatches(period, limit = 1000) {
      const rows = db.prepare(`
        SELECT dq.id AS digest_id, dq.subscriber_id, dq.call_id, s.email, s.status, s.preferred_frequency, s.resend_contact_id, c.data AS call_json
        FROM email_digest_queue dq
        JOIN email_subscribers s ON s.id = dq.subscriber_id
        JOIN calls c ON c.id = dq.call_id
        WHERE dq.digest_period = ? AND dq.processed_at IS NULL AND s.status = 'ACTIVE' AND s.preferred_frequency = ?
        ORDER BY dq.created_at ASC
        LIMIT ?
      `).all(period, period, limit);
      const batches = new Map();
      for (const row of rows) {
        if (!batches.has(row.subscriber_id)) {
          batches.set(row.subscriber_id, {
            subscriber: {
              id: row.subscriber_id,
              email: row.email,
              status: row.status,
              preferred_frequency: row.preferred_frequency,
              resend_contact_id: row.resend_contact_id,
              preferences: [],
            },
            calls: [],
            digestIds: [],
          });
        }
        const batch = batches.get(row.subscriber_id);
        batch.digestIds.push(row.digest_id);
        batch.calls.push(parseJson(row.call_json, { id: row.call_id }));
      }
      return [...batches.values()];
    },
    markDigestProcessed(digestIds = []) {
      if (!digestIds.length) return 0;
      const now = new Date().toISOString();
      const stmt = db.prepare("UPDATE email_digest_queue SET processed_at = ? WHERE id = ? AND processed_at IS NULL");
      const tx = db.transaction((ids) => ids.reduce((count, digestId) => count + stmt.run(now, digestId).changes, 0));
      return tx(digestIds);
    },
    createNotificationForDigest({ subscriberId, type, periodStart, periodEnd, contentHash, providerMessageId = "", status = "SENT" }) {
      const notificationId = id("notif");
      const callId = `digest:${type}:${periodStart}:${periodEnd}:${contentHash}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO email_notifications (
          id, subscriber_id, call_id, notification_type, provider, provider_message_id, status, sent_at, updated_at
        )
        VALUES (?, ?, ?, ?, 'resend', ?, ?, ?, ?)
      `).run(notificationId, subscriberId, callId, type, providerMessageId, status, now, now);
      if (providerMessageId || status !== "PENDING") {
        db.prepare(`
          UPDATE email_notifications
          SET provider = 'resend', provider_message_id = COALESCE(NULLIF(?, ''), provider_message_id),
            status = ?, sent_at = COALESCE(sent_at, ?), updated_at = ?
          WHERE subscriber_id = ? AND call_id = ? AND notification_type = ?
        `).run(providerMessageId, status, now, now, subscriberId, callId, type);
      }
      return db.prepare("SELECT * FROM email_notifications WHERE subscriber_id = ? AND call_id = ? AND notification_type = ?").get(subscriberId, callId, type);
    },
    startNewsletterRun({ frequency, periodStart, periodEnd }) {
      const runId = id("run");
      db.prepare(`
        INSERT OR IGNORE INTO newsletter_runs (id, frequency, period_start, period_end, status)
        VALUES (?, ?, ?, ?, 'RUNNING')
      `).run(runId, frequency, periodStart, periodEnd);
      const run = db.prepare("SELECT * FROM newsletter_runs WHERE frequency = ? AND period_start = ? AND period_end = ?").get(frequency, periodStart, periodEnd);
      if (run.id !== runId && run.status === "COMPLETED") return { run, acquired: false, reason: "already_completed" };
      if (run.id !== runId && run.status === "RUNNING") return { run, acquired: false, reason: "already_running" };
      if (run.id !== runId) return { run, acquired: false, reason: `already_${String(run.status || "started").toLowerCase()}` };
      return { run, acquired: true };
    },
    completeNewsletterRun(runId, patch = {}) {
      db.prepare(`
        UPDATE newsletter_runs
        SET status = ?, completed_at = ?, total_subscribers = ?, successful_sends = ?,
          failed_sends = ?, skipped_sends = ?, error_summary = ?
        WHERE id = ?
      `).run(
        patch.status || "COMPLETED",
        new Date().toISOString(),
        patch.totalSubscribers || 0,
        patch.successfulSends || 0,
        patch.failedSends || 0,
        patch.skippedSends || 0,
        patch.errorSummary || "",
        runId,
      );
      return db.prepare("SELECT * FROM newsletter_runs WHERE id = ?").get(runId);
    },
    notificationExistsForCall(callId) {
      return Boolean(db.prepare("SELECT 1 FROM notification_outbox WHERE event_type = 'CALL_PUBLISHED' AND aggregate_id = ?").get(callId));
    },
    recordDeliveryEvent({ notificationId, providerEventId, eventType, payload, occurredAt = new Date().toISOString() }) {
      db.prepare(`
        INSERT OR IGNORE INTO email_delivery_events (id, notification_id, provider_event_id, event_type, payload_json, occurred_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id("evt"), notificationId || null, providerEventId, eventType, json(payload), occurredAt);
    },
    updateNotificationForProviderMessage(providerMessageId, patch = {}) {
      const row = db.prepare("SELECT * FROM email_notifications WHERE provider_message_id = ?").get(providerMessageId);
      if (!row) return null;
      const now = new Date().toISOString();
      if (patch.status === "DELIVERED") db.prepare("UPDATE email_notifications SET status = ?, delivered_at = ?, updated_at = ? WHERE id = ?").run("DELIVERED", now, now, row.id);
      if (patch.status === "FAILED") db.prepare("UPDATE email_notifications SET status = ?, failed_at = ?, error_code = ?, error_message = ?, updated_at = ? WHERE id = ?").run("FAILED", now, patch.errorCode || "", patch.errorMessage || "", now, row.id);
      if (patch.opened) db.prepare("UPDATE email_notifications SET opened_at = COALESCE(opened_at, ?), updated_at = ? WHERE id = ?").run(now, now, row.id);
      if (patch.clicked) db.prepare("UPDATE email_notifications SET clicked_at = COALESCE(clicked_at, ?), updated_at = ? WHERE id = ?").run(now, now, row.id);
      return db.prepare("SELECT * FROM email_notifications WHERE id = ?").get(row.id);
    },
    suppressSubscriber(subscriberId, status) {
      const allowed = new Set(["BOUNCED", "COMPLAINED", "SUPPRESSED"]);
      if (!allowed.has(status)) return null;
      db.prepare("UPDATE email_subscribers SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), subscriberId);
      return this.findSubscriberById(subscriberId);
    },
    metrics() {
      const subscriberRows = db.prepare("SELECT status, COUNT(*) AS count FROM email_subscribers GROUP BY status").all();
      const notificationRows = db.prepare("SELECT status, COUNT(*) AS count FROM email_notifications GROUP BY status").all();
      const digestRows = db.prepare("SELECT digest_period, COUNT(*) AS count FROM email_digest_queue WHERE processed_at IS NULL GROUP BY digest_period").all();
      const asMap = (rows, key) => Object.fromEntries(rows.map((row) => [row[key], row.count]));
      const subscribers = asMap(subscriberRows, "status");
      const notifications = asMap(notificationRows, "status");
      const digests = asMap(digestRows, "digest_period");
      const sent = notifications.SENT || notifications.DELIVERED || 0;
      return {
        pendingSubscribers: subscribers.PENDING || 0,
        activeSubscribers: subscribers.ACTIVE || 0,
        unsubscribed: subscribers.UNSUBSCRIBED || 0,
        bounced: subscribers.BOUNCED || 0,
        complained: subscribers.COMPLAINED || 0,
        sent,
        delivered: notifications.DELIVERED || 0,
        failed: notifications.FAILED || 0,
        dailyDigestCount: digests.DAILY || 0,
        weeklyDigestCount: digests.WEEKLY || 0,
        deliveryRate: sent ? Math.round(((notifications.DELIVERED || 0) / sent) * 1000) / 10 : 0,
        bounceRate: sent ? Math.round(((subscribers.BOUNCED || 0) / sent) * 1000) / 10 : 0,
        complaintRate: sent ? Math.round(((subscribers.COMPLAINED || 0) / sent) * 1000) / 10 : 0,
      };
    },
    listSubscribers(limit = 100) {
      return db.prepare("SELECT id, email, status, preferred_frequency, created_at, confirmed_at, unsubscribed_at FROM email_subscribers ORDER BY created_at DESC LIMIT ?").all(limit);
    },
    listNotifications(limit = 100) {
      return db.prepare("SELECT * FROM email_notifications ORDER BY created_at DESC LIMIT ?").all(limit);
    },
    outbox(limit = 25) {
      return db.prepare("SELECT * FROM notification_outbox WHERE status = 'PENDING' AND available_at <= ? ORDER BY created_at LIMIT ?").all(new Date().toISOString(), limit).map((row) => ({ ...row, payload: parseJson(row.payload_json, {}) }));
    },
    close() {
      db.close();
    },
  };
}
