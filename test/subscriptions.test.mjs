import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createSubscriptionRepository } from "../server/email/subscription-repository.mjs";
import {
  generateToken,
  hashToken,
  normalizeEmail,
  signSubscriberToken,
  verifySubscriberToken,
} from "../server/email/subscription-utils.mjs";
import {
  applyResendWebhook,
  confirmSubscription,
  createCallPublishedOutbox,
  isEmailEligibleCall,
  prepareNotificationsForCall,
  scheduleForFrequency,
  subscriberMatchesCall,
  unsubscribeByToken,
  verifyWebhookSignature,
} from "../server/email/subscription-service.mjs";
import { buildVerificationEmail, createResendProvider } from "../server/email/providers/resend-provider.mjs";

function makeRepo() {
  const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hiberota-email-")), "database.sqlite");
  return createSubscriptionRepository({ databasePath });
}

function addSubscriber(repo, overrides = {}) {
  const token = generateToken();
  const subscriber = repo.subscribe({
    email: overrides.email || " USER@Example.com ",
    verificationTokenHash: hashToken(token),
    verificationExpiresAt: overrides.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    consentIp: "127.0.0.1",
    consentUserAgent: "node-test",
    frequency: overrides.frequency || "DAILY",
    interests: overrides.interests || ["Avrupa", "KOBİ"],
  });
  return { subscriber, token };
}

test("normalizes email and stores hashed verification tokens", () => {
  const repo = makeRepo();
  const { subscriber, token } = addSubscriber(repo);
  assert.equal(normalizeEmail(" USER@Example.com "), "user@example.com");
  assert.equal(subscriber.email_normalized, "user@example.com");
  assert.notEqual(subscriber.verification_token_hash, token);
  assert.equal(subscriber.verification_token_hash, hashToken(token));
  repo.close();
});

test("confirms only non-expired one-time verification tokens", () => {
  const repo = makeRepo();
  const { subscriber, token } = addSubscriber(repo);
  const confirmed = confirmSubscription(token, repo);
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.subscriber.status, "ACTIVE");
  assert.equal(repo.findSubscriberById(subscriber.id).verification_token_hash, null);
  assert.equal(confirmSubscription(token, repo).ok, false);

  const expiredRepo = makeRepo();
  const expired = addSubscriber(expiredRepo, { email: "expired@example.com", expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.equal(confirmSubscription(expired.token, expiredRepo).code, "expired_token");
  repo.close();
  expiredRepo.close();
});

test("signed unsubscribe token suppresses subscriber and pending jobs", () => {
  const repo = makeRepo();
  const { subscriber } = addSubscriber(repo);
  repo.confirmSubscriber(subscriber.id);
  repo.createNotification({ subscriberId: subscriber.id, callId: "call-a", type: "INSTANT", status: "QUEUED" });
  const token = signSubscriberToken(subscriber.id);
  assert.equal(verifySubscriberToken(token), subscriber.id);
  const result = unsubscribeByToken(token, repo);
  assert.equal(result.ok, true);
  assert.equal(repo.findSubscriberById(subscriber.id).status, "UNSUBSCRIBED");
  repo.close();
});

test("matches subscriber preferences against call fields", () => {
  const repo = makeRepo();
  const { subscriber } = addSubscriber(repo, { interests: ["Yapay zekâ"] });
  assert.equal(subscriberMatchesCall(subscriber, { title: "Yapay zekâ ve dijital dönüşüm çağrısı" }), true);
  assert.equal(subscriberMatchesCall(subscriber, { title: "Tarım çağrısı" }), false);
  assert.equal(subscriberMatchesCall({ ...subscriber, preferences: [] }, { title: "Herhangi" }), true);
  repo.close();
});

test("prevents duplicate call notification outbox and notification rows", () => {
  const repo = makeRepo();
  const { subscriber } = addSubscriber(repo, { frequency: "INSTANT", interests: [] });
  repo.confirmSubscriber(subscriber.id);
  const call = {
    id: "call-a",
    title: "Açık çağrı",
    status: "open",
    isPublished: true,
    confidenceScore: 95,
    officialUrl: "https://example.com/call",
    deadline: "2099-01-01T00:00:00.000Z",
    reviewStatus: "approved",
  };
  assert.equal(isEmailEligibleCall(call), true);
  assert.equal(createCallPublishedOutbox(call, repo).created, true);
  assert.equal(createCallPublishedOutbox(call, repo).created, false);
  prepareNotificationsForCall(call, repo);
  prepareNotificationsForCall(call, repo);
  assert.equal(repo.listNotifications(10).length, 1);
  repo.close();
});

test("digest scheduling and provider adapter are safe without API key", async () => {
  const repo = makeRepo();
  const { subscriber, token } = addSubscriber(repo);
  assert.match(scheduleForFrequency("DAILY", new Date("2026-06-19T08:00:00+03:00")), /T06:00:00/);
  assert.match(buildVerificationEmail({ subscriber, verificationToken: token }).html, /Aboneliği doğrula/);
  const provider = createResendProvider();
  const result = await provider.sendVerificationEmail({ subscriber, verificationToken: token });
  assert.equal(result.skipped, true);
  repo.close();
});

test("webhook signature is verified and bounce suppresses subscriber", () => {
  process.env.EMAIL_WEBHOOK_SECRET = "webhook-test";
  const repo = makeRepo();
  const { subscriber } = addSubscriber(repo, { frequency: "INSTANT", interests: [] });
  repo.confirmSubscriber(subscriber.id);
  const notification = repo.createNotification({ subscriberId: subscriber.id, callId: "call-a", type: "INSTANT" });
  const raw = Buffer.from(JSON.stringify({ id: "evt_1", type: "email.bounced", data: { email_id: "msg_1", tags: { subscriber_id: subscriber.id } } }));
  const sig = crypto.createHmac("sha256", process.env.EMAIL_WEBHOOK_SECRET).update(raw).digest("hex");
  assert.equal(verifyWebhookSignature(raw, { "resend-signature": sig }), true);
  repo.updateNotificationForProviderMessage = () => ({ ...notification, provider_message_id: "msg_1" });
  applyResendWebhook(JSON.parse(raw.toString("utf8")), repo);
  assert.equal(repo.findSubscriberById(subscriber.id).status, "BOUNCED");
  repo.close();
});
