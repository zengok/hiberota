import crypto from "node:crypto";
import { createSubscriptionRepository } from "./subscription-repository.mjs";
import { createResendProvider } from "./providers/resend-provider.mjs";
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
  const confirmed = repo.confirmSubscriber(subscriber.id);
  syncResendContact(confirmed, repo).catch(() => {});
  return { ok: true, subscriber: confirmed, manageToken: signSubscriberToken(subscriber.id) };
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
  if (subscriber) syncResendContact(subscriber, repo).catch(() => {});
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
  next.setHours(9, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  if (frequency === "WEEKLY") {
    const day = next.getDay() || 7;
    if (day !== 1 || next <= now) next.setDate(next.getDate() + (8 - day));
  }
  if (frequency === "MONTHLY") {
    if (next.getDate() !== 1 || next <= now) next.setMonth(next.getMonth() + 1, 1);
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
    repo.enqueueDigest({ subscriberId: subscriber.id, callId: call.id, period: subscriber.preferred_frequency });
    created += 1;
  }
  return { created };
}

export function newsletterPeriod(frequency, now = new Date()) {
  const d = new Date(now);
  const end = new Date(d);
  if (frequency === "DAILY") {
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
  }
  if (frequency === "WEEKLY") {
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
  }
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1, 0, 0, 0));
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1, 0, 0, 0));
  return { periodStart: start.toISOString(), periodEnd: stop.toISOString() };
}

export function selectNewsletterCalls(frequency, now = new Date(), repo = getSubscriptionRepository()) {
  const { periodStart, periodEnd } = newsletterPeriod(frequency, now);
  const nowMs = now.getTime();
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();
  const closeWindowDays = frequency === "DAILY" ? 7 : frequency === "WEEKLY" ? 14 : 31;
  const limit = frequency === "MONTHLY" ? 20 : frequency === "WEEKLY" ? 15 : 15;
  const seen = new Set();
  const calls = repo.listPublishedCalls()
    .filter((call) => isEmailEligibleCall(call, { minConfidence: 0 }))
    .filter((call) => {
      const created = Date.parse(call.createdAt || call.firstDetectedAt || call.publishedAt || call.updatedAt || "");
      const activated = Date.parse(call.publishedAt || call.firstDetectedAt || "");
      const deadline = Date.parse(call.deadline || "");
      const createdInPeriod = Number.isFinite(created) && created >= startMs && created < endMs;
      const activeInPeriod = Number.isFinite(activated) && activated >= startMs && activated < endMs;
      const closingSoon = Number.isFinite(deadline) && deadline >= nowMs && deadline <= nowMs + closeWindowDays * 24 * 60 * 60 * 1000;
      return createdInPeriod || activeInPeriod || closingSoon;
    })
    .filter((call) => {
      const key = call.contentHash || call.officialUrl || call.applicationUrl || call.url || call.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (Date.parse(a.deadline || "9999-12-31") || Infinity) - (Date.parse(b.deadline || "9999-12-31") || Infinity))
    .slice(0, limit)
    .map((call) => decorateCallForEmail(call, now));
  return { calls, periodStart, periodEnd };
}

export async function runNewsletterCron(frequency, { now = new Date(), repo = getSubscriptionRepository(), provider = createResendProvider() } = {}) {
  if (!FREQUENCIES.has(frequency)) return { ok: false, status: 400, code: "invalid_frequency" };
  const selected = selectNewsletterCalls(frequency, now, repo);
  const runState = repo.startNewsletterRun({ frequency, periodStart: selected.periodStart, periodEnd: selected.periodEnd });
  if (!runState.acquired) return { ok: true, skipped: true, reason: runState.reason, run: runState.run };
  if (!selected.calls.length) {
    const run = repo.completeNewsletterRun(runState.run.id, { status: "SKIPPED", skippedSends: 1, errorSummary: "no_calls" });
    return { ok: true, skipped: true, reason: "no_calls", run };
  }
  const subscribers = repo.activeSubscribers().filter((subscriber) => subscriber.preferred_frequency === frequency);
  let successfulSends = 0;
  let failedSends = 0;
  let skippedSends = 0;
  const errors = [];
  for (const subscriber of subscribers) {
    const calls = selected.calls.filter((call) => subscriberMatchesCall(subscriber, call));
    if (!calls.length) {
      skippedSends += 1;
      continue;
    }
    const contentHash = hashToken(JSON.stringify({ frequency, periodStart: selected.periodStart, periodEnd: selected.periodEnd, calls: calls.map((call) => call.id) }));
    const existing = repo.createNotificationForDigest({
      subscriberId: subscriber.id,
      type: frequency,
      periodStart: selected.periodStart,
      periodEnd: selected.periodEnd,
      contentHash,
      status: "PENDING",
    });
    if (existing.status === "SENT" || existing.status === "DELIVERED") {
      skippedSends += 1;
      continue;
    }
    try {
      const send = frequency === "MONTHLY"
        ? await provider.sendMonthlyDigest({ subscriber, calls })
        : frequency === "WEEKLY"
          ? await provider.sendWeeklyDigest({ subscriber, calls })
          : await provider.sendDailyDigest({ subscriber, calls });
      repo.createNotificationForDigest({
        subscriberId: subscriber.id,
        type: frequency,
        periodStart: selected.periodStart,
        periodEnd: selected.periodEnd,
        contentHash,
        providerMessageId: send.id || "",
        status: send.skipped ? "SKIPPED" : "SENT",
      });
      successfulSends += send.skipped ? 0 : 1;
      skippedSends += send.skipped ? 1 : 0;
    } catch (error) {
      failedSends += 1;
      errors.push(error.message);
    }
  }
  const run = repo.completeNewsletterRun(runState.run.id, {
    status: failedSends && !successfulSends ? "FAILED" : "COMPLETED",
    totalSubscribers: subscribers.length,
    successfulSends,
    failedSends,
    skippedSends,
    errorSummary: errors.slice(0, 5).join("; "),
  });
  return { ok: true, run, calls: selected.calls.length };
}

async function syncResendContact(subscriber, repo = getSubscriptionRepository()) {
  if (!process.env.RESEND_API_KEY || !subscriber?.email) return null;
  const response = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: subscriber.email,
      unsubscribed: subscriber.status !== "ACTIVE",
      first_name: "",
      last_name: "",
      data: {
        newsletter_frequency: subscriber.preferred_frequency,
        subscription_status: subscriber.status,
        subscribed_at: subscriber.confirmed_at || subscriber.created_at,
        source: "hiberota.com",
      },
    }),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return repo.updateResendContact(subscriber.id, { contactId: data.id || data.contact?.id || "" });
}

function decorateCallForEmail(call, now) {
  const deadlineMs = Date.parse(call.deadline || "");
  const daysLeft = Number.isFinite(deadlineMs) ? Math.max(0, Math.ceil((deadlineMs - now.getTime()) / (24 * 60 * 60 * 1000))) : null;
  return {
    ...call,
    deadlineLabel: Number.isFinite(deadlineMs)
      ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(new Date(deadlineMs))
      : "",
    daysLeft,
  };
}

export function verifyWebhookSignature(rawBody, headers = {}, secret = process.env.RESEND_WEBHOOK_SECRET || process.env.EMAIL_WEBHOOK_SECRET || "") {
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
  if (subscriberId && /contact\.unsubscribed/i.test(eventType)) repo.unsubscribe(subscriberId);
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
