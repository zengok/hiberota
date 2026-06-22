import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScheduledJobs } from "../server/automation/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const statePath = process.env.AUTOMATION_STATE_PATH || path.join(root, ".hiberota", "automation-state.json");
const intervalMs = Number(process.env.WORKER_INTERVAL_MS || 60 * 60 * 1000);
const heartbeatMs = Number(process.env.WORKER_HEARTBEAT_MS || 30000);
const runOnStart = process.env.WORKER_RUN_ON_START !== "false";

let running = false;
let intervalTimer = null;
let heartbeatTimer = null;

function log(payload) {
  console.log(JSON.stringify({ level: "info", timestamp: new Date().toISOString(), ...payload }));
}

async function runOnce(reason = "scheduled") {
  if (running) {
    log({ message: "automation_worker_skip", reason: "already_running" });
    return;
  }
  running = true;
  const started = Date.now();
  try {
    const result = await runScheduledJobs({ statePath });
    log({
      message: "automation_worker_run_complete",
      reason,
      calls: result.calls.length,
      errors: result.errors.length,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "automation_worker_run_failed",
      error: error.message,
      timestamp: new Date().toISOString(),
    }));
  } finally {
    running = false;
  }
}

log({
  message: "automation_worker_ready",
  statePath,
  intervalMs,
  runOnStart,
});

heartbeatTimer = setInterval(() => {
  log({ message: "automation_worker_heartbeat", running });
}, heartbeatMs);

if (runOnStart) runOnce("startup");
intervalTimer = setInterval(() => runOnce("interval"), intervalMs);

function shutdown(signal) {
  log({ message: "automation_worker_shutdown", signal });
  clearInterval(intervalTimer);
  clearInterval(heartbeatTimer);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
