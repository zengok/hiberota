import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

function requireFile(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) errors.push(`Missing required file: ${relativePath}`);
}

function requireEnv(name, validator = Boolean, hint = "is required") {
  const value = process.env[name] || "";
  if (!validator(value)) errors.push(`${name} ${hint}`);
}

requireFile("Dockerfile");
requireFile("deploy/docker-compose.prod.yml");
requireFile("deploy/nginx/hiberota.conf");
const envFilePath = path.join(root, ".env");
if (!fs.existsSync(envFilePath)) {
  warnings.push(".env file is missing; this is acceptable only when production environment variables are injected by the platform.");
}

requireEnv("NODE_ENV", (value) => value === "production", "must be production");
requireEnv("ADMIN_API_TOKEN", (value) => value.length >= 32 && !value.includes("change-me") && !value.includes("replace-with"), "must be a real random token with at least 32 characters");
requireEnv("SESSION_SECRET", (value) => value.length >= 32 && !value.includes("change-me") && !value.includes("replace-with"), "must be a real random secret with at least 32 characters");
requireEnv("ADMIN_USERNAME", (value) => value.length >= 3 && !value.includes("replace-with"), "must be configured");
requireEnv("ADMIN_PASSWORD_HASH", (value) => value.startsWith("scrypt$") && !value.includes("replace-with"), "must be generated with npm run admin:hash");
requireEnv("DATABASE_PATH", (value) => value.length > 0, "is required");
requireEnv("SOURCE_USER_AGENT", (value) => value.includes("Hiberota") && value.includes("contact:"), "should identify Hiberota and include a contact email");

const totalMemGb = os.totalmem() / 1024 / 1024 / 1024;
if (totalMemGb < 3.5) warnings.push(`Detected ${totalMemGb.toFixed(1)} GB RAM; VPS target is 4 GB. Keep worker profile disabled for first launch.`);

const databasePath = process.env.DATABASE_PATH || "";
if (databasePath && !databasePath.startsWith("/app/.hiberota")) {
  warnings.push("DATABASE_PATH is outside /app/.hiberota; make sure it is backed by persistent storage in Docker.");
}

if (errors.length) {
  console.error("Production preflight failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Production preflight passed.");
for (const warning of warnings) console.warn(`Warning: ${warning}`);
