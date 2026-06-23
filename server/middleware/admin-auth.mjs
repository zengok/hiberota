import crypto from "node:crypto";

const AUTH_SCHEME = "Bearer ";
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000);

function timingSafeEqualText(left = "", right = "") {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_API_TOKEN || process.env.ADMIN_API_KEY || "";
}

function configuredUsername() {
  return process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || "";
}

export function hashAdminPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password = "", storedHash = "") {
  const [algorithm, salt, expected] = String(storedHash).split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return timingSafeEqualText(actual, expected);
}

export function isAdminPasswordLoginConfigured() {
  return Boolean(configuredUsername() && process.env.ADMIN_PASSWORD_HASH && sessionSecret());
}

export function authenticateAdminCredentials(username = "", password = "") {
  const expectedUsername = configuredUsername();
  if (!isAdminPasswordLoginConfigured()) return null;
  if (!timingSafeEqualText(String(username).trim(), expectedUsername)) return null;
  if (!verifyPassword(password, process.env.ADMIN_PASSWORD_HASH)) return null;
  return { username: expectedUsername };
}

export function signAdminSession(username, now = Date.now()) {
  const secret = sessionSecret();
  if (!secret) throw new Error("admin_session_not_configured");
  const payload = {
    v: 1,
    sub: username,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encodedPayload = base64UrlJson(payload);
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function verifyAdminSession(token = "", now = Date.now()) {
  const secret = sessionSecret();
  const [encodedPayload, signature] = String(token).split(".");
  if (!secret || !encodedPayload || !signature) return null;
  const expectedSignature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  if (!timingSafeEqualText(signature, expectedSignature)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload?.v !== 1 || !payload.sub || Number(payload.exp) <= now) return null;
  const expectedUsername = configuredUsername();
  if (expectedUsername && payload.sub !== expectedUsername) return null;
  return { username: payload.sub, expiresAt: new Date(payload.exp).toISOString() };
}

export function adminAuth(req, res, next) {
  const configuredToken = process.env.ADMIN_API_TOKEN || process.env.ADMIN_API_KEY || "";
  const header = req.get("authorization") || "";
  const token = header.startsWith(AUTH_SCHEME) ? header.slice(AUTH_SCHEME.length).trim() : "";
  if (!token) return res.status(401).json({ error: "unauthorized" });
  if (configuredToken && timingSafeEqualText(token, configuredToken)) return next();
  const session = verifyAdminSession(token);
  if (session) {
    req.admin = session;
    return next();
  }
  if (!configuredToken && !isAdminPasswordLoginConfigured()) return res.status(503).json({ error: "admin_auth_not_configured" });
  return res.status(401).json({ error: "unauthorized" });
}

export function adminSessionStatus() {
  return {
    loginConfigured: isAdminPasswordLoginConfigured(),
    usernameConfigured: Boolean(configuredUsername()),
  };
}

export function buildAdminSession(username) {
  return signAdminSession(username);
}

export function generateAdminPasswordHashCli(password) {
  return hashAdminPassword(password);
}
