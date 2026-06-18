import test from "node:test";
import assert from "node:assert/strict";
import { metricsSnapshot, prometheusMetrics } from "../server/utils/metrics.mjs";

test("prometheusMetrics renders core counters and automation gauges", () => {
  const output = prometheusMetrics(metricsSnapshot({
    automation: {
      manualReviewPending: 3,
      publishedCalls: 42,
    },
  }));

  assert.match(output, /hiberota_process_uptime_seconds/);
  assert.match(output, /hiberota_http_requests_total/);
  assert.match(output, /hiberota_manual_review_queue_size 3/);
  assert.match(output, /hiberota_calls_published 42/);
});
