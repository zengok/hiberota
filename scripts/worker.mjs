import "dotenv/config";

const intervalMs = Number(process.env.WORKER_HEARTBEAT_MS || 30000);

console.log(JSON.stringify({
  level: "info",
  message: "automation_worker_ready",
  note: "Worker extraction point is available; scraper execution still runs in the app process until the queue adapter is moved.",
  timestamp: new Date().toISOString(),
}));

const timer = setInterval(() => {
  console.log(JSON.stringify({ level: "info", message: "automation_worker_heartbeat", timestamp: new Date().toISOString() }));
}, intervalMs);

function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", message: "automation_worker_shutdown", signal, timestamp: new Date().toISOString() }));
  clearInterval(timer);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
