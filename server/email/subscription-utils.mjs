import crypto from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SUBSCRIBER_STATUSES = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  UNSUBSCRIBED: "UNSUBSCRIBED",
  BOUNCED: "BOUNCED",
  COMPLAINED: "COMPLAINED",
  SUPPRESSED: "SUPPRESSED",
};

export const FREQUENCIES = new Set(["INSTANT", "DAILY", "WEEKLY"]);

export const INTERESTS = new Set([
  "Ulusal",
  "Avrupa",
  "Uluslararası",
  "Öğrenci",
  "Akademisyen",
  "Araştırmacı",
  "Girişimci",
  "KOBİ",
  "Sağlık",
  "Yapay zekâ",
  "Dijital dönüşüm",
  "Çevre ve sürdürülebilirlik",
]);

export function normalizeEmail(email = "") {
  return String(email).trim().toLocaleLowerCase("en-US");
}

export function isValidEmail(email = "") {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && EMAIL_RE.test(normalized);
}

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(token = "") {
  return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

export function timingSafeEqualHex(a = "", b = "") {
  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function signSubscriberToken(subscriberId, secret = process.env.EMAIL_TOKEN_SECRET || process.env.EMAIL_WEBHOOK_SECRET || process.env.SESSION_SECRET || "dev-email-secret") {
  const payload = Buffer.from(JSON.stringify({ sub: subscriberId, iat: Date.now() }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySubscriberToken(token = "", secret = process.env.EMAIL_TOKEN_SECRET || process.env.EMAIL_WEBHOOK_SECRET || process.env.SESSION_SECRET || "dev-email-secret") {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed?.sub || null;
  } catch {
    return null;
  }
}

export function maskEmail(email = "") {
  const [name, domain] = String(email).split("@");
  if (!name || !domain) return "masked";
  return `${name.slice(0, 1)}***@${domain}`;
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPublicUrl(path = "/") {
  const base = process.env.APP_PUBLIC_URL || "http://localhost:5173";
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

export function groupDigestCalls(calls = []) {
  const groups = new Map();
  for (const call of calls) {
    const key = call.scope || call.category || "Genel";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(call);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
