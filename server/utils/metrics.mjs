const startedAt = Date.now();
const http = {
  total: 0,
  errors: 0,
  durations: [],
  byRoute: new Map(),
};

function routeKey(req) {
  const path = req.route?.path ? String(req.route.path) : req.path;
  return `${req.method} ${path}`;
}

function observeDuration(ms) {
  http.durations.push(ms);
  if (http.durations.length > 1000) http.durations.shift();
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function metricsMiddleware(req, res, next) {
  const started = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - started;
    const key = routeKey(req);
    const current = http.byRoute.get(key) || { total: 0, errors: 0, durationMs: 0 };
    current.total += 1;
    current.durationMs += durationMs;
    if (res.statusCode >= 500) {
      current.errors += 1;
      http.errors += 1;
    }
    http.total += 1;
    observeDuration(durationMs);
    http.byRoute.set(key, current);
  });
  next();
}

export function metricsSnapshot({ cache = null, automation = null } = {}) {
  return {
    process: {
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    },
    http: {
      total: http.total,
      errors: http.errors,
      averageDurationMs: Number(average(http.durations).toFixed(2)),
      routes: [...http.byRoute.entries()].map(([route, value]) => ({
        route,
        total: value.total,
        errors: value.errors,
        averageDurationMs: Number((value.durationMs / value.total).toFixed(2)),
      })),
    },
    cache,
    automation,
  };
}

export function prometheusMetrics(snapshot) {
  const lines = [
    "# HELP hiberota_process_uptime_seconds Process uptime in seconds.",
    "# TYPE hiberota_process_uptime_seconds gauge",
    `hiberota_process_uptime_seconds ${snapshot.process.uptimeSec}`,
    "# HELP hiberota_http_requests_total Total HTTP requests.",
    "# TYPE hiberota_http_requests_total counter",
    `hiberota_http_requests_total ${snapshot.http.total}`,
    "# HELP hiberota_http_errors_total Total HTTP 5xx responses.",
    "# TYPE hiberota_http_errors_total counter",
    `hiberota_http_errors_total ${snapshot.http.errors}`,
    "# HELP hiberota_http_request_duration_ms_average Rolling average HTTP request duration.",
    "# TYPE hiberota_http_request_duration_ms_average gauge",
    `hiberota_http_request_duration_ms_average ${snapshot.http.averageDurationMs}`,
  ];

  const manualReview = snapshot.automation?.manualReviewPending;
  if (typeof manualReview === "number") {
    lines.push("# HELP hiberota_manual_review_queue_size Pending manual review items.");
    lines.push("# TYPE hiberota_manual_review_queue_size gauge");
    lines.push(`hiberota_manual_review_queue_size ${manualReview}`);
  }

  const published = snapshot.automation?.publishedCalls;
  if (typeof published === "number") {
    lines.push("# HELP hiberota_calls_published Published call count.");
    lines.push("# TYPE hiberota_calls_published gauge");
    lines.push(`hiberota_calls_published ${published}`);
  }

  return `${lines.join("\n")}\n`;
}
