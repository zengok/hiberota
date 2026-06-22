import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AutomationQueue,
  JOB_TYPES,
  SOURCE_REGISTRY,
  buildAutomationMetrics,
  buildLinkCheckCandidates,
  buildManualReviewItems,
  createSourceAdapters,
  dedupeAndFlag,
  detectChanges,
  loadAutomationState,
  mergeManualReviewQueue,
  saveAutomationState,
  updateSourceHealth,
  verifyLinks,
} from "./core.mjs";
import { createCallPublishedOutbox } from "../email/subscription-service.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_STATE_PATH = process.env.AUTOMATION_STATE_PATH || path.join(root, ".hiberota", "automation-state.json");

export function createAutomationQueue(options = {}) {
  return new AutomationQueue({ concurrency: Number(process.env.CRAWLER_CONCURRENCY || 2), ...options });
}

export async function createScraperRegistry() {
  const { createScraperStrategies } = await import("../scrapers/index.mjs");
  return createScraperStrategies();
}

function sortByDeadline(a, b) {
  const ax = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
  const bx = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
  return ax - bx;
}

function buildPayload(state, { cache = null, quality = null, errors = [] } = {}) {
  const calls = Object.values(state.calls || {}).filter((call) => call?.isPublished).sort(sortByDeadline);
  const metrics = state.metrics || buildAutomationMetrics(state, Object.values(state.calls || {}));
  return {
    calls,
    errors,
    fetchedAt: new Date().toISOString(),
    quality: quality || {
      rejected: 0,
      rejectedSamples: [],
      duplicates: state.duplicates?.length || 0,
      manualReviewPending: metrics.manualReviewPending || 0,
      unpublished: Object.values(state.calls || {}).filter((call) => !call?.isPublished).length,
    },
    automation: {
      statePath: DEFAULT_STATE_PATH,
      sources: Object.values(state.sources || {}).length,
      metrics,
    },
    cache,
  };
}

function qualityGateCalls(items) {
  const rejected = [];
  const calls = [];
  const manualReviewCalls = [];
  for (const call of items) {
    if (call.reviewStatus === "rejected" || call.isAccepted === false) {
      rejected.push({ id: call.id, title: call.title, source: call.source, reason: "low_institution_confidence" });
    } else if (call.isPublished) {
      calls.push(call);
    } else {
      manualReviewCalls.push(call);
    }
  }
  return { calls, manualReviewCalls, rejected };
}

function restoreQueue(queue, state = {}) {
  queue.restore(state.crawlerJobs || {});
  return queue;
}

function enqueueDiscoveryJobs(queue, adapters = []) {
  for (const adapter of adapters) {
    queue.enqueue({
      type: JOB_TYPES.DISCOVER_SOURCE,
      sourceId: adapter.id,
      url: adapter.listUrls?.[0],
      priority: adapter.sourceType === "official" ? 1 : 3,
      idempotencyKey: `${JOB_TYPES.DISCOVER_SOURCE}:${adapter.id}`,
    });
  }
}

function enqueueDetailJobs(queue, adapter, rawItems = []) {
  for (const item of rawItems) {
    if (!item?.url) continue;
    queue.enqueue({
      type: JOB_TYPES.FETCH_DETAIL_PAGE,
      sourceId: adapter.id,
      url: item.url,
      priority: adapter.sourceType === "official" ? 2 : 4,
      payload: { listItemId: item.id },
      idempotencyKey: `${JOB_TYPES.FETCH_DETAIL_PAGE}:${adapter.id}:${item.url}`,
    });
  }
}

function enqueueLinkHealthJobs(queue, calls = []) {
  for (const candidate of buildLinkCheckCandidates(calls)) {
    queue.enqueue({
      type: JOB_TYPES.VERIFY_LINKS,
      sourceId: "",
      url: candidate.url,
      priority: 9,
      payload: candidate,
      idempotencyKey: `${JOB_TYPES.VERIFY_LINKS}:${candidate.callId}:${candidate.type}:${candidate.url}`,
      timeoutMs: Number(process.env.LINK_VERIFY_TIMEOUT_MS || 5000),
    });
  }
}

function recentLinkHealthChecks(checks = [], calls = []) {
  const liveIds = new Set(calls.map((call) => call.id));
  const maxAgeMs = Number(process.env.LINK_HEALTH_MAX_AGE_MS || 24 * HOUR_MS);
  const cutoff = Date.now() - maxAgeMs;
  const byKey = new Map();
  for (const check of checks) {
    if (!liveIds.has(check.callId)) continue;
    if (new Date(check.checkedAt || 0).getTime() < cutoff) continue;
    const key = `${check.callId}:${check.type}:${check.url}`;
    const previous = byKey.get(key);
    if (!previous || new Date(check.checkedAt).getTime() > new Date(previous.checkedAt).getTime()) byKey.set(key, check);
  }
  return [...byKey.values()];
}

export async function getPublishedCalls({ statePath = DEFAULT_STATE_PATH, cache = null } = {}) {
  const state = await loadAutomationState(statePath);
  return buildPayload(state, { cache });
}

export async function getAutomationMetrics({ statePath = DEFAULT_STATE_PATH } = {}) {
  const state = await loadAutomationState(statePath);
  return {
    metrics: state.metrics || buildAutomationMetrics(state, Object.values(state.calls || {})),
    quality: {
      duplicates: state.duplicates?.length || 0,
      manualReviewPending: state.manualReviewQueue?.filter((item) => item.status === "pending").length || 0,
    },
  };
}

export async function enqueueAutomationRefresh({ statePath = DEFAULT_STATE_PATH, sourceId = null } = {}) {
  const state = await loadAutomationState(statePath);
  const queue = restoreQueue(createAutomationQueue(), state);
  const sources = sourceId ? SOURCE_REGISTRY.filter((source) => source.id === sourceId) : SOURCE_REGISTRY.filter((source) => source.isActive);
  enqueueDiscoveryJobs(queue, sources);
  state.crawlerJobs = queue.persistableSnapshot();
  state.metrics = buildAutomationMetrics(state, Object.values(state.calls || {}));
  await saveAutomationState(statePath, state);
  return { queued: sources.length, queue: queue.snapshot(), fetchedAt: new Date().toISOString() };
}

export async function runSource(sourceId, options = {}) {
  const result = await runScheduledJobs({ ...options, sourceIds: [sourceId] });
  return result;
}

export async function runScheduledJobs({ statePath = DEFAULT_STATE_PATH, sourceIds = null, queue = createAutomationQueue() } = {}) {
  const state = await loadAutomationState(statePath);
  restoreQueue(queue, state);
  const scraperMap = await createScraperRegistry();
  const requested = sourceIds ? new Set(sourceIds) : null;
  const adapters = createSourceAdapters(scraperMap).filter((adapter) => !requested || requested.has(adapter.id));
  const errors = [];
  const calls = [];

  enqueueDiscoveryJobs(queue, adapters);

  await Promise.all(
    adapters.map(async (adapter) => {
      const started = Date.now();
      try {
        const rawItems = await adapter.extractStructuredData();
        enqueueDetailJobs(queue, adapter, rawItems);
        const validated = await adapter.validateExtractedData(rawItems);
        const normalized = await adapter.normalizeData(validated, state.calls || {});
        calls.push(...normalized);
        updateSourceHealth(state, adapter, { ok: true, durationMs: Date.now() - started, status: 200, found: normalized.length });
      } catch (error) {
        errors.push({ source: adapter.name, sourceId: adapter.id, message: error.message || "Kaynak okunamadı" });
        updateSourceHealth(state, adapter, { ok: false, durationMs: Date.now() - started, error });
      }
    }),
  );

  const unique = calls.sort(sortByDeadline);
  const quality = qualityGateCalls(unique);
  const acceptedCalls = [...quality.calls, ...quality.manualReviewCalls];
  const duplicateResult = dedupeAndFlag(acceptedCalls);
  const previousCalls = state.calls || {};
  const changeLogs = detectChanges(previousCalls, duplicateResult.calls);
  const linkHealthChecks = recentLinkHealthChecks(state.linkHealthChecks || [], duplicateResult.calls);
  const reviewItems = buildManualReviewItems(duplicateResult.calls, duplicateResult.duplicates, linkHealthChecks);
  enqueueLinkHealthJobs(queue, duplicateResult.calls);

  state.calls = Object.fromEntries(duplicateResult.calls.map((call) => [call.id, call]));
  state.duplicates = duplicateResult.duplicates;
  state.callChangeLogs = [...(state.callChangeLogs || []), ...changeLogs].slice(-1000);
  state.linkHealthChecks = (state.linkHealthChecks || []).slice(-1000);
  state.manualReviewQueue = mergeManualReviewQueue(state.manualReviewQueue || [], reviewItems);
  state.crawlerJobs = queue.persistableSnapshot();
  state.metrics = buildAutomationMetrics(state, duplicateResult.calls);
  await saveAutomationState(statePath, state);

  await refreshCallStatuses({ statePath, queue });

  const publishedCalls = duplicateResult.calls.filter((call) => call.isPublished);
  const emailNotifications = { created: 0, skipped: 0 };
  for (const call of publishedCalls) {
    const result = createCallPublishedOutbox(call);
    if (result.created) emailNotifications.created += 1;
    else emailNotifications.skipped += 1;
  }

  return buildPayload(state, {
    errors,
    quality: {
      rejected: quality.rejected.length,
      rejectedSamples: quality.rejected.slice(0, 10),
      duplicates: duplicateResult.duplicates.length,
      manualReviewPending: state.metrics.manualReviewPending,
      unpublished: duplicateResult.calls.length - publishedCalls.length,
    },
  });
}

export async function refreshCallStatuses({ statePath = DEFAULT_STATE_PATH, queue = createAutomationQueue(), limit = Number(process.env.LINK_HEALTH_WORKER_LIMIT || process.env.LINK_VERIFY_LIMIT || 25) } = {}) {
  const state = await loadAutomationState(statePath);
  restoreQueue(queue, state);
  const calls = Object.values(state.calls || {});
  if (!calls.length) return { checks: [], metrics: state.metrics || {} };
  const candidates = buildLinkCheckCandidates(calls, { limit });
  const checks = await verifyLinks(calls, {
    timeoutMs: Number(process.env.LINK_VERIFY_TIMEOUT_MS || 5000),
    candidates,
  });
  for (const check of checks) {
    queue.completeByIdempotencyKey(`${JOB_TYPES.VERIFY_LINKS}:${check.callId}:${check.type}:${check.url}`, {
      status: check.status,
      httpStatus: check.httpStatus || null,
    });
  }
  state.linkHealthChecks = [...(state.linkHealthChecks || []), ...checks].slice(-1000);
  state.manualReviewQueue = mergeManualReviewQueue(
    state.manualReviewQueue || [],
    buildManualReviewItems(calls, state.duplicates || [], recentLinkHealthChecks(state.linkHealthChecks, calls)),
  );
  state.crawlerJobs = queue.persistableSnapshot();
  state.metrics = buildAutomationMetrics(state, calls);
  await saveAutomationState(statePath, state);
  return { checks, metrics: state.metrics };
}
