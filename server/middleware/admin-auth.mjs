import crypto from "node:crypto";

const AUTH_SCHEME = "Bearer ";

function timingSafeEqualText(left = "", right = "") {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function adminAuth(req, res, next) {
  const configuredToken = process.env.ADMIN_API_TOKEN || process.env.ADMIN_API_KEY || "";
  if (!configuredToken) return res.status(503).json({ error: "admin_auth_not_configured" });
  const header = req.get("authorization") || "";
  const token = header.startsWith(AUTH_SCHEME) ? header.slice(AUTH_SCHEME.length).trim() : "";
  if (!token || !timingSafeEqualText(token, configuredToken)) return res.status(401).json({ error: "unauthorized" });
  return next();
}
