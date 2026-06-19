import crypto from "node:crypto";
import { createSubscriptionRepository } from "./subscription-repository.mjs";
import {
  FREQUENCIES,
  INTERESTS,
  SUBSCRIBER_STATUSES,
  generateToken,
  hashToken,
  isValidEmail,
  normalizeEmail,
  signSubscriberToken,
  timingSafeEqualHex,
  verifySubscriberToken,
} from "./subscription-utils.mjs";

let repository;

export function getSubscriptionRepository() {
  if (!repository) repository = createSubscriptionRepository();
  return repository;
}

export function validateSubscriptionPayload(body = {}) {
  const email = normalizeEmail(body.email);
  const frequency = FREQUENCIES.has(body.frequency) ? body.frequency : "DAILY";
  const interests = Array.isArray(body.interests) ? body.interests.filter((item) => INTERESTS.has(item)).slice(0, 24) : [];
  if (body.website) return { ok: false, status: 202, code: "accepted" };
  if (!isValidEmail(email)) return { ok: false, status: 400, code: "validation_error", field: "email" };
  if (body.consent !== true) return { ok: false, status: 400, code: "validation_error", field: "consent" };
  return { ok: true, value: { email, frequency, interests } };
}

export async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const form = new FormData();
  form.set("secret", process.env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  return Boolean(data.success);
}

export async function subscribe(body, req, repo = getSubscriptionRepository()) {
  const validation = validateSubscriptionPayload(body);
  if (!validation.ok) return validation;
  const turnstileOk = await verifyTurnstile(body.turnstileToken, req.ip);
  if (!turnstileOk) return { ok: false, status: 400, code: "turnstile_failed" };
  const verificationToken = generateToken(32);
  const subscriber = repo.subscribe({
    email: validation.value.email,
    verificationTokenHash: hashToken(verificationToken),
    verificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    consentIp: req.ip,
    consentUserAgent: req.get("user-agent") || "",
    frequency: validation.value.frequency,
    interests: validation.value.interests,
  });
  return { ok: true, subscriber, verificationToken };
}

export function confirmSubscription(token, repo = getSubscriptionRepository()) {
  const tokenHash = hashToken(token || "");
  const subscriber = repo.findByVerificationHash(tokenHash);
  if (!subscriber?.verification_token_hash || !timingSafeEqualHex(tokenHash, subscriber.verification_token_hash)) return { ok: false, code: "invalid_token" };
  if (new Date(subscriber.verification_expires_at).getTime() < Date.now()) return { ok: false, code: "expired_token", subscriber };
  return { ok: true, subscriber: repo.confirmSubscriber(subscriber.id), manageToken: signSubscriberToken(subscriber.id) };
}

export function resendConfirmation(email, repo = getSubscriptionRepository()) {
  if (!isValidEmail(email)) return { ok: true };
  const subscriber = repo.listSubscribers(1000).find((item) => normalizeEmail(item.email) === normalizeEmail(email));
  if (!subscriber || subscriber.status === SUBSCRIBER_STATUSES.ACTIVE) return { ok: true };
  const token = generateToken(32);
  repo.updateVerification(subscriber.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1000).toISOString());
  return { ok: true, token };
}

export function unsubscribeByToken(token, repo = getSubscriptionRepository()) {
  const subscriberId = verifySubscriberToken(token);
  if (!subscriberId) return { ok: false, code: "invalid_token" };
  const subscriber = repo.unsubscribe(subscriberId);
  return { ok: Boolean(subscriber), subscriber };
}

export function subscriberMatchesCall(subscriber, call = {}) {
  const prefs = (subscriber.preferences || []).filter((pref) => pref.preference_type === "interest").map((pref) => pref.preference_value);
  if (!prefs.length) return true;
  const haystack = [
    call.scope,
    call.audience,
    call.targetAudience,
    call.category,
    call.categories,
    call.funder,
    call.country,
    call.programme,
    call.program,
    call.title,
    call.summary,
  ].flat().filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
  return prefs.some((pref) => haystack.includes(String(pref).toLocaleLowerCase("tr-TR")));
}

export function isEmailEligibleCall(call = {}, { minConfidence = Number(process.env.EMAIL_NOTIFICATION_CONFIDENCE_MIN || 80) } = {}) {
  const status = String(call.status || call.normalizedStatus || "").toLocaleLowerCase("en-US");
  const deadlineMs = call.deadline ? new Date(call.deadline).getTime() : Number.MAX_SAFE_INTEGER;
  return Boolean(
    (call.isPublished || status === "open" || status === "published") &&
      (call.confidenceScore || 0) >= minConfidence &&
      !call.isDuplicate &&
      deadlineMs >= Date.now() &&
      (call.officialUrl || call.applicationUrl || call.url) &&
      call.reviewStatus !== "manual_review" &&
      call.reviewStatus !== "rejected",
  );
}

export function scheduleForFrequency(frequency, now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  if (frequency === "INSTANT") return now.toISOString();
  next.setHours(9, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  if (frequency === "WEEKLY") {
    const day = next.getDay() || 7;
    if (day !== 1 || next <= now) next.setDate(next.getDate() + (8 - day));
  }
  return next.toISOString();
}

export function createCallPublishedOutbox(call, repo = getSubscriptionRepository()) {
  if (!isEmailEligibleCall(call)) return { created: false, reason: "not_eligible" };
  if (repo.notificationExistsForCall(call.id)) return { created: false, reason: "duplicate" };
  repo.enqueueOutbox("CALL_PUBLISHED", call.id, { call });
  return { created: true };
}

export function prepareNotificationsForCall(call, repo = getSubscriptionRepository()) {
  const subscribers = repo.activeSubscribers().filter((subscriber) => !["UNSUBSCRIBED", "BOUNCED", "COMPLAINED", "SUPPRESSED"].includes(subscriber.status));
  let created = 0;
  for (const subscriber of subscribers) {
    if (!subscriberMatchesCall(subscriber, call)) continue;
    if (subscriber.preferred_frequency === "INSTANT") {
      repo.createNotification({ subscriberId: subscriber.id, callId: call.id, type: "INSTANT", scheduledAt: scheduleForFrequency("INSTANT"), status: "QUEUED" });
    } else {
      repo.enqueueDigest({ subscriberId: subscriber.id, callId: call.id, period: subscriber.preferred_frequency });
    }
    created += 1;
  }
  return { created };
}

export function verifyWebhookSignature(rawBody, headers = {}, secret = process.env.EMAIL_WEBHOOK_SECRET || "") {
  if (!secret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ""));
  const expectedHex = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const signatures = [
    headers["resend-signature"],
    headers["x-resend-signature"],
    headers["svix-signature"],
  ].filter(Boolean).flatMap((value) => String(value).split(" "));
  return signatures.some((signature) => {
    const clean = signature.includes(",") ? signature.split(",").at(-1) : signature;
    const value = clean.includes("=") ? clean.split("=").at(-1) : clean;
    return value.length === expectedHex.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expectedHex));
  });
}

export function applyResendWebhook(payload = {}, repo = getSubscriptionRepository()) {
  const eventId = payload.id || payload.event_id || payload.data?.id;
  const eventType = payload.type || payload.event || "";
  const providerMessageId = payload.data?.email_id || payload.data?.id || payload.email_id || "";
  if (!eventId) return { ok: false, code: "missing_event_id" };
  const notification = providerMessageId ? repo.updateNotificationForProviderMessage(providerMessageId, webhookPatch(eventType, payload)) : null;
  repo.recordDeliveryEvent({ notificationId: notification?.id, providerEventId: eventId, eventType, payload, occurredAt: payload.created_at || new Date().toISOString() });
  const subscriberId = notification?.subscriber_id || payload.data?.tags?.subscriber_id;
  if (subscriberId && /bounce/i.test(eventType)) repo.suppressSubscriber(subscriberId, "BOUNCED");
  if (subscriberId && /complain/i.test(eventType)) repo.suppressSubscriber(subscriberId, "COMPLAINED");
  return { ok: true };
}

function webhookPatch(eventType, payload) {
  if (/delivered/i.test(eventType)) return { status: "DELIVERED" };
  if (/bounce/i.test(eventType)) return { status: "FAILED", errorCode: "bounce", errorMessage: "Provider bounce" };
  if (/complain/i.test(eventType)) return { status: "FAILED", errorCode: "complaint", errorMessage: "Provider complaint" };
  if (/open/i.test(eventType)) return { opened: true };
  if (/click/i.test(eventType)) return { clicked: true };
  if (/sent/i.test(eventType)) return { status: "SENT" };
  return { status: payload.type || "EVENT" };
}
