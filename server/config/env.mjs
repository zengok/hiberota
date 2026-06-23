import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const env = {
  root,
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 5173),
  host: process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  databaseUrl: process.env.DATABASE_URL || "",
  automationStatePath: process.env.AUTOMATION_STATE_PATH || path.join(root, ".hiberota", "automation-state.json"),
  adminUsername: process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || "",
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  sessionSecret: process.env.SESSION_SECRET || "",
};

export function assertProductionEnv() {
  if (!env.isProduction) return;
  const missing = [];
  const adminToken = process.env.ADMIN_API_TOKEN || process.env.ADMIN_API_KEY || "";
  if (!adminToken) missing.push("ADMIN_API_TOKEN");
  if (adminToken && (adminToken.includes("change-me") || adminToken.length < 32)) {
    missing.push("ADMIN_API_TOKEN>=32_random_chars");
  }
  if (!env.adminUsername) missing.push("ADMIN_USERNAME");
  if (!env.adminPasswordHash) missing.push("ADMIN_PASSWORD_HASH");
  if (!env.sessionSecret || env.sessionSecret.length < 32) missing.push("SESSION_SECRET>=32_random_chars");
  if (missing.length) {
    throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }
}
