import express from "express";
import compression from "compression";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import { assertProductionEnv } from "./config/env.mjs";
import { adminAuth } from "./middleware/admin-auth.mjs";
import { errorHandler } from "./middleware/error-handler.mjs";
import { requestId } from "./middleware/request-id.mjs";
import { dateMs, daysUntil, filterCalls, scopeFromParam, statusGroup } from "./services/call-filter-service.mjs";
import { paginatedResponse, parsePositiveInt, sendJsonWithEtag } from "./utils/api-response.mjs";
import { metricsMiddleware, metricsSnapshot, prometheusMetrics } from "./utils/metrics.mjs";
import {
  AutomationQueue,
  JOB_TYPES,
  SOURCE_REGISTRY,
  enqueueAutomationRefresh,
  getAutomationMetrics,
  getPublishedCalls,
  loadAutomationState,
  saveAutomationState,
} from "./automation.mjs";
import { GLOBAL_FUNDING_DATABASE, matchGlobalFundingDatabase } from "./fundingMatcher.mjs";
import {
  applyResendWebhook,
  confirmSubscription,
  getSubscriptionRepository,
  resendConfirmation,
  subscribe,
  unsubscribeByToken,
  verifyWebhookSignature,
} from "./email/subscription-service.mjs";
import { FREQUENCIES, INTERESTS, maskEmail, verifySubscriberToken } from "./email/subscription-utils.mjs";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
});

assertProductionEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
const PORT = Number(process.env.PORT || 5173);
const isProd = process.env.NODE_ENV === "production";
const HOST = process.env.HOST || (isProd ? "0.0.0.0" : "127.0.0.1");
const HOUR_MS = 60 * 60 * 1000;
const CACHE_TTL_MS = Number(process.env.CALL_CACHE_TTL_MS || HOUR_MS);
const MAX_AGE_IMMUTABLE = "1y";
const AUTOMATION_STATE_PATH = process.env.AUTOMATION_STATE_PATH || path.join(root, ".hiberota", "automation-state.json");
const MAX_URL_LENGTH = Number(process.env.MAX_URL_LENGTH || 2048);
const MAX_JSON_BODY = process.env.MAX_JSON_BODY || "32kb";
const MAX_SSE_CLIENTS = Number(process.env.MAX_SSE_CLIENTS || 100);

let callCache = null;
let callCachePromise = null;
let hourlyRefreshTimer = null;
const automationQueue = new AutomationQueue({ concurrency: Number(process.env.CRAWLER_CONCURRENCY || 2) });

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(requestId);
app.use(compression());
app.use(metricsMiddleware);

morgan.token("safe-url", (req) => {
  const parsedUrl = new URL(req.originalUrl || req.url || "/", "http://localhost");
  for (const key of ["api_key", "token", "access_token", "authorization"]) {
    if (parsedUrl.searchParams.has(key)) parsedUrl.searchParams.set(key, "[redacted]");
  }
  return `${parsedUrl.pathname}${parsedUrl.search}`;
});

app.use(
  morgan(":remote-addr - :remote-user [:date[clf]] \":method :safe-url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\"", {
    skip: (req) => req.path === "/healthz",
  }),
);

app.use((req, res, next) => {
  if ((req.originalUrl || req.url || "").length > MAX_URL_LENGTH) return res.status(414).json({ error: "url_too_long" });
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  next();
});

app.use((req, res, next) => {
  const allowed = new Set(["GET", "POST", "PUT", "HEAD", "OPTIONS"]);
  if (!allowed.has(req.method)) return res.status(405).json({ error: "method_not_allowed" });
  next();
});

app.use((req, res, next) => {
  if (req.method !== "GET" || !req.query) return next();
  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value)) return res.status(400).json({ error: "invalid_query", field: key });
    if (String(value ?? "").length > 512) return res.status(400).json({ error: "query_value_too_long", field: key });
  }
  next();
});

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});
app.use("/api/", apiLimiter);

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "admin_rate_limited" },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "refresh_rate_limited" },
});

const matchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "match_rate_limited" },
});

const subscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "subscription_rate_limited" },
});

const exportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "export_rate_limited" },
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  }),
);

function normalizeWhitespace(value = "") {
  return String(value).replace(/<[a-z/][^>]*>/gi, " ").replace(/\s+/g, " ").trim();
}

function normalizeBoundedText(value = "", maxLength = 500) {
  if (typeof value !== "string") return "";
  return normalizeWhitespace(value).slice(0, maxLength);
}

function slug(value) {
  return normalizeWhitespace(value)
    .toLowerCase("tr")
    .replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function getCachedCalls({ force = false } = {}) {
  const now = Date.now();
  if (!force && callCache && now - callCache.cachedAtMs < CACHE_TTL_MS) {
    return { ...callCache.payload, cache: { status: "hit", ttlMs: CACHE_TTL_MS, ageMs: now - callCache.cachedAtMs } };
  }

  if (!force && callCachePromise) {
    const payload = await callCachePromise;
    return { ...payload, cache: { status: "shared-refresh", ttlMs: CACHE_TTL_MS, ageMs: 0 } };
  }

  callCachePromise = (async () => {
    const refreshQueued = force ? await enqueueAutomationRefresh({ statePath: AUTOMATION_STATE_PATH }) : null;
    const payload = await getPublishedCalls({ statePath: AUTOMATION_STATE_PATH });
    return refreshQueued ? { ...payload, refreshQueued } : payload;
  })()
    .then((payload) => {
      callCache = { payload, cachedAtMs: Date.now() };
      if (typeof broadcastRefresh === "function") broadcastRefresh();
      return payload;
    })
    .finally(() => {
      callCachePromise = null;
    });

  const payload = await callCachePromise;
  return { ...payload, cache: { status: force ? "queued-refresh" : "miss", ttlMs: CACHE_TTL_MS, ageMs: 0 } };
}

function msUntilNextHour() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function scheduleHourlyRefresh() {
  hourlyRefreshTimer = setTimeout(async function refreshOnHour() {
    try {
      await getCachedCalls({ force: true });
      console.log(`Hourly call refresh completed at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`Hourly call refresh failed: ${error.message}`);
    } finally {
      hourlyRefreshTimer = setTimeout(refreshOnHour, HOUR_MS);
    }
  }, msUntilNextHour());
}

function inferredTargetGroups(call) {
  if (call.targetAudience?.length) return call.targetAudience;
  const text = `${call.title || ""} ${call.summary || ""} ${call.category || ""}`.toLocaleLowerCase("tr-TR");
  const groups = [];
  if (/öğrenci|student|doctoral|doktora/.test(text)) groups.push("Öğrenciler ve doktora araştırmacıları");
  if (/akadem|üniversite|university|researcher|araştırmac/.test(text)) groups.push("Akademisyenler ve araştırmacılar");
  if (/kobi|sme|firma|şirket|company|startup|girişim/.test(text)) groups.push("KOBİ'ler, girişimler ve şirketler");
  if (/kamu|belediye|public/.test(text)) groups.push("Kamu kurumları ve yerel yönetimler");
  return groups.length ? groups : ["Çağrı koşullarına uygun başvuru sahipleri"];
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportRows(calls) {
  return calls.map((call) => ({
    "Çağrı adı": call.title,
    "Program": call.category,
    "Program kodu": call.externalId || "",
    "Fon sağlayıcı": call.funder,
    "Kapsam": call.scope,
    "Durum": call.status,
    "Açılış tarihi": call.publishedAt || "",
    "Son başvuru tarihi": call.deadline || "",
    "Kalan gün": daysUntil(call.deadline) ?? "",
    "Destek türü": call.supportType || call.category,
    "Destek miktarı": call.budgetMax ? `${Number(call.budgetMax).toLocaleString("tr-TR")} ${call.currency || ""}`.trim() : call.support || "",
    "Destek oranı": call.supportRate ? `%${call.supportRate}` : "",
    "Para birimi": call.currency || "",
    "Hedef kitle": "",
    "Tematik alan": call.category,
    "Türkiye uygunluğu": call.scope === "Ulusal" || call.scope === "Avrupa" ? "Kontrol edilmeli" : "Kaynak detayında kontrol edilmeli",
    "Ortaklık şartı": "",
    "Resmî çağrı bağlantısı": call.officialUrl || call.url,
    "Başvuru bağlantısı": call.applicationUrl || call.url,
    "Son kontrol tarihi": call.lastVerifiedAt || new Date().toISOString(),
  }));
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] || { "Çağrı adı": "" });
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function makeXlsx(rows) {
  const headers = Object.keys(rows[0] || { "Çağrı adı": "" });
  const sheetRows = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map(
      (row) =>
        `<row>${row
          .map((cell) => `<c t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`)
          .join("")}</row>`,
    )
    .join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cagrilar" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

function makePdf(rows) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).text("Hibe Rota - Çağrı Listesi");
    doc.moveDown();
    rows.slice(0, 80).forEach((row, index) => {
      doc.fontSize(10).text(`${index + 1}. ${row["Çağrı adı"]}`, { continued: false });
      doc.fontSize(8).fillColor("#444").text(`${row["Fon sağlayıcı"]} | ${row["Kapsam"]} | Son başvuru: ${row["Son başvuru tarihi"]}`);
      doc.fillColor("#000").moveDown(0.4);
    });
    doc.end();
  });
}

function makeIcs(call) {
  const start = call.deadline ? new Date(call.deadline) : new Date();
  const ymd = start.toISOString().slice(0, 10).replace(/-/g, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hibe Rota//TR",
    "BEGIN:VEVENT",
    `UID:${call.id}@hiberota`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART;VALUE=DATE:${ymd}`,
    `SUMMARY:${call.title}`,
    `DESCRIPTION:${call.summary || call.category} ${call.url}`,
    `URL:${call.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function rssXml(title, calls, req) {
  const base = `${req.protocol}://${req.get("host")}`;
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(title)}</title><link>${base}</link><description>Hibe Rota çağrı akışı</description>${calls
    .slice(0, 50)
    .map((call) => `<item><title>${xmlEscape(call.title)}</title><link>${xmlEscape(call.url)}</link><guid>${xmlEscape(call.id)}</guid><description>${xmlEscape(call.summary || call.category)}</description></item>`)
    .join("")}</channel></rss>`;
}

app.get("/api/calls", async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await getCachedCalls());
  } catch (error) {
    res.status(500).json({ calls: [], errors: [{ source: "api", message: error.message }], fetchedAt: new Date().toISOString() });
  }
});

app.post("/api/calls/refresh", refreshLimiter, adminAuth, async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await getCachedCalls({ force: true }));
  } catch (error) {
    res.status(500).json({ calls: [], errors: [{ source: "api", message: error.message }], fetchedAt: new Date().toISOString() });
  }
});

function findPublicCall(calls, value) {
  return calls.find((item) => item.id === value || item.slug === value);
}

function similarPublicCalls(call, calls) {
  return calls
    .filter((item) => item.id !== call.id)
    .map((item) => {
      let score = 0;
      if (statusGroup(item) === "open") score += 8;
      if (item.scope === call.scope) score += 5;
      if (item.funder === call.funder) score += 4;
      if (item.category === call.category) score += 4;
      if ((item.categories || []).some((category) => (call.categories || []).includes(category))) score += 3;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || dateMs(a.item.deadline) - dateMs(b.item.deadline))
    .slice(0, 4)
    .map(({ item }) => item);
}

app.get("/api/calls/:slug", async (req, res) => {
  const payload = await getCachedCalls();
  const call = findPublicCall(payload.calls, decodeURIComponent(req.params.slug));
  if (!call) return res.status(404).json({ error: "call_not_found" });
  res.set("Cache-Control", "no-store");
  res.json(call);
});

app.get("/api/calls/:slug/similar", async (req, res) => {
  const payload = await getCachedCalls();
  const call = findPublicCall(payload.calls, decodeURIComponent(req.params.slug));
  if (!call) return res.status(404).json({ error: "call_not_found" });
  res.json({ calls: similarPublicCalls(call, payload.calls) });
});

let sseClients = [];
app.get("/api/v1/stream", (req, res) => {
  if (sseClients.length >= MAX_SSE_CLIENTS) return res.status(429).json({ error: "too_many_stream_clients" });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  
  const clientId = Date.now();
  sseClients.push({ id: clientId, res });
  
  req.on("close", () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

function broadcastRefresh() {
  sseClients.forEach(c => c.res.write(`data: {"type": "refresh"}\n\n`));
}

app.get("/api/v1/calls", async (req, res) => {
  const payload = await getCachedCalls();
  const page = parsePositiveInt(req.query.page, 1, { max: 100000 });
  const limit = parsePositiveInt(req.query.pageSize ?? req.query.limit, 24, { max: 100 });
  const filtered = filterCalls(payload.calls, req.query);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  const response = paginatedResponse({
    data: paginated,
    page,
    pageSize: limit,
    total: filtered.length,
    requestId: req.requestId,
    generatedAt: payload.fetchedAt,
    extraMeta: {
      cache: payload.cache || null,
      quality: payload.quality || null,
    },
  });

  return sendJsonWithEtag(req, res, {
    ...response,
    errors: payload.errors || [],
    fetchedAt: payload.fetchedAt,
    quality: payload.quality,
    automation: payload.automation,
    calls: paginated,
    pagination: {
      ...response.pagination,
      limit,
      pages: response.pagination.totalPages,
    },
  });
});

app.get("/api/v1/calls/:id", async (req, res) => {
  const payload = await getCachedCalls();
  const call = findPublicCall(payload.calls, decodeURIComponent(req.params.id));
  if (!call) return res.status(404).json({ error: "call_not_found" });
  return res.json(call);
});

app.get("/api/v1/calls/:id/similar", async (req, res) => {
  const payload = await getCachedCalls();
  const call = findPublicCall(payload.calls, decodeURIComponent(req.params.id));
  if (!call) return res.status(404).json({ error: "call_not_found" });
  const similar = payload.calls
    .filter((item) => item.id !== call.id && (item.scope === call.scope || item.category === call.category || item.funder === call.funder))
    .slice(0, 12);
  return res.json({ calls: similar });
});

app.get("/api/v1/programmes", async (_req, res) => {
  const payload = await getCachedCalls();
  const programmes = [...new Set(payload.calls.map((call) => call.programme).filter(Boolean))].sort();
  res.json({ programmes });
});

app.get("/api/v1/programs", async (_req, res) => {
  const payload = await getCachedCalls();
  const programs = [...new Set(payload.calls.map((call) => call.programme).filter(Boolean))].sort();
  res.json({ data: programs, programs, meta: { generatedAt: payload.fetchedAt } });
});

app.get("/api/v1/sources", async (_req, res) => {
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  const sources = SOURCE_REGISTRY.map((source) => ({ ...source, ...(state.sources?.[source.id] || {}) }));
  res.json({ data: sources, sources });
});

app.get("/api/v1/programmes/:id", async (req, res) => {
  const payload = await getCachedCalls();
  const calls = payload.calls.filter((call) => slug(call.programme) === req.params.id || call.programme === req.params.id);
  if (!calls.length) return res.status(404).json({ error: "programme_not_found" });
  res.json({ id: req.params.id, name: calls[0].programme, calls });
});

app.get("/api/v1/funders", async (_req, res) => {
  const payload = await getCachedCalls();
  const funders = [...new Set(payload.calls.map((call) => call.funder).filter(Boolean))].sort();
  res.json({ funders });
});

app.get("/api/institutions", async (_req, res) => {
  const payload = await getCachedCalls();
  const institutions = [...new Set(payload.calls.map((call) => call.institution || call.funder).filter(Boolean))].sort();
  res.json({ institutions });
});

app.get("/api/v1/funders/:id", async (req, res) => {
  const payload = await getCachedCalls();
  const calls = payload.calls.filter((call) => slug(call.funder) === req.params.id || call.funder === req.params.id);
  if (!calls.length) return res.status(404).json({ error: "funder_not_found" });
  res.json({ id: req.params.id, name: calls[0].funder, calls });
});

app.get("/api/v1/themes", async (_req, res) => {
  const payload = await getCachedCalls();
  res.json({ themes: [...new Set(payload.calls.map((call) => call.category).filter(Boolean))].sort() });
});

app.get("/api/themes", async (_req, res) => {
  const payload = await getCachedCalls();
  const themes = [...new Set(payload.calls.flatMap((call) => [call.category, call.programme, ...(call.categories || [])]).filter(Boolean))].sort();
  res.json({ themes });
});

app.get("/api/target-groups", async (_req, res) => {
  const payload = await getCachedCalls();
  const targetGroups = [...new Set(payload.calls.flatMap((call) => inferredTargetGroups(call)).filter(Boolean))].sort();
  res.json({ targetGroups });
});

app.get("/api/v1/categories", async (_req, res) => {
  const payload = await getCachedCalls();
  res.json({ categories: [...new Set(payload.calls.map((call) => call.category).filter(Boolean))].sort() });
});

app.get("/api/v1/automation/sources", async (_req, res) => {
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  const sources = SOURCE_REGISTRY.map((source) => ({ ...source, ...(state.sources?.[source.id] || {}) }));
  res.json({ sources });
});

app.get("/api/v1/automation/metrics", async (_req, res) => {
  const metrics = await getAutomationMetrics({ statePath: AUTOMATION_STATE_PATH });
  res.json({
    metrics: metrics.metrics,
    quality: metrics.quality,
    cache: callCache ? { status: "hit", ttlMs: CACHE_TTL_MS, ageMs: Date.now() - callCache.cachedAtMs } : { status: "empty" },
  });
});

app.get("/api/v1/automation/manual-review", async (_req, res) => {
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  res.json({ items: state.manualReviewQueue || [] });
});

app.get("/api/v1/automation/change-log", async (_req, res) => {
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  res.json({ changes: (state.callChangeLogs || []).slice(-250).reverse() });
});

app.get("/api/v1/automation/link-health", async (_req, res) => {
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  res.json({ checks: (state.linkHealthChecks || []).slice(-250).reverse() });
});

app.get("/api/v1/automation/jobs", async (_req, res) => {
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  automationQueue.restore(state.crawlerJobs || {});
  res.json({ queue: automationQueue.snapshot(), supportedJobTypes: Object.values(JOB_TYPES) });
});

app.post("/api/v1/subscriptions", subscriptionLimiter, express.json({ limit: "12kb", strict: true }), async (req, res, next) => {
  try {
    const result = await subscribe(req.body || {}, req);
    if (!result.ok && result.status !== 202) return res.status(result.status || 400).json({ status: result.code || "validation_error", field: result.field });
    res.status(202).json({ status: "confirmation_sent" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/subscriptions/confirm", (req, res) => {
  const result = confirmSubscription(String(req.query.token || ""));
  if (!result.ok) return res.redirect(`/abonelik-dogrulandi?status=${encodeURIComponent(result.code)}`);
  res.redirect(`/abonelik-dogrulandi?status=success&token=${encodeURIComponent(result.manageToken)}`);
});

app.post("/api/v1/subscriptions/confirm", express.json({ limit: "8kb", strict: true }), (req, res) => {
  const result = confirmSubscription(String(req.body?.token || ""));
  if (!result.ok) return res.status(400).json({ status: result.code });
  res.json({ status: "confirmed", token: result.manageToken });
});

app.post("/api/v1/subscriptions/resend-confirmation", subscriptionLimiter, express.json({ limit: "8kb", strict: true }), (req, res) => {
  resendConfirmation(String(req.body?.email || ""));
  res.status(202).json({ status: "confirmation_sent" });
});

app.post("/api/v1/subscriptions/unsubscribe", express.json({ limit: "8kb", strict: true }), (req, res) => {
  const result = unsubscribeByToken(String(req.body?.token || req.query.token || ""));
  if (!result.ok) return res.status(400).json({ status: "invalid_token" });
  res.json({ status: "unsubscribed" });
});

app.get("/api/v1/subscriptions/unsubscribe", (req, res) => {
  const result = unsubscribeByToken(String(req.query.token || ""));
  res.redirect(`/abonelikten-cikildi?status=${result.ok ? "success" : "invalid_token"}`);
});

app.get("/api/v1/subscriptions/preferences", (req, res) => {
  const subscriberId = verifySubscriberToken(String(req.query.token || ""));
  const subscriber = subscriberId ? getSubscriptionRepository().findSubscriberById(subscriberId) : null;
  if (!subscriber) return res.status(400).json({ status: "invalid_token" });
  res.json({
    email: maskEmail(subscriber.email),
    status: subscriber.status,
    frequency: subscriber.preferred_frequency,
    interests: subscriber.preferences.filter((pref) => pref.preference_type === "interest").map((pref) => pref.preference_value),
  });
});

app.put("/api/v1/subscriptions/preferences", express.json({ limit: "12kb", strict: true }), (req, res) => {
  const subscriberId = verifySubscriberToken(String(req.body?.token || ""));
  const repo = getSubscriptionRepository();
  const subscriber = subscriberId ? repo.findSubscriberById(subscriberId) : null;
  if (!subscriber) return res.status(400).json({ status: "invalid_token" });
  const frequency = FREQUENCIES.has(req.body?.frequency) ? req.body.frequency : subscriber.preferred_frequency;
  const interests = Array.isArray(req.body?.interests) ? req.body.interests.filter((item) => INTERESTS.has(item)).slice(0, 24) : [];
  const updated = repo.updatePreferences(subscriberId, { frequency, interests });
  res.json({
    status: "updated",
    frequency: updated.preferred_frequency,
    interests: updated.preferences.filter((pref) => pref.preference_type === "interest").map((pref) => pref.preference_value),
  });
});

app.post("/api/v1/email/webhooks/resend", express.raw({ type: "application/json", limit: "64kb" }), (req, res) => {
  if (!verifyWebhookSignature(req.body, req.headers)) return res.status(401).json({ error: "invalid_signature" });
  const payload = JSON.parse(req.body.toString("utf8"));
  const result = applyResendWebhook(payload);
  res.json(result);
});

app.get("/api/v1/admin/email/metrics", adminLimiter, adminAuth, (_req, res) => {
  res.json({ metrics: getSubscriptionRepository().metrics() });
});

app.get("/api/v1/admin/email/subscribers", adminLimiter, adminAuth, (req, res) => {
  const limit = Math.min(500, parsePositiveInt(req.query.limit, 100));
  const subscribers = getSubscriptionRepository().listSubscribers(limit).map((subscriber) => ({ ...subscriber, email: maskEmail(subscriber.email) }));
  res.json({ subscribers });
});

app.get("/api/v1/admin/email/notifications", adminLimiter, adminAuth, (req, res) => {
  const limit = Math.min(500, parsePositiveInt(req.query.limit, 100));
  res.json({ notifications: getSubscriptionRepository().listNotifications(limit) });
});

app.post("/api/v1/admin/email/test", adminLimiter, adminAuth, express.json({ limit: "8kb", strict: true }), (_req, res) => {
  const outboxId = getSubscriptionRepository().enqueueOutbox("SEND_TEST_EMAIL", "admin-test", { createdAt: new Date().toISOString() });
  res.status(202).json({ status: "queued", outboxId });
});

app.post("/api/v1/admin/email/subscribers/:id/suppress", adminLimiter, adminAuth, express.json({ limit: "8kb", strict: true }), (req, res) => {
  const status = ["BOUNCED", "COMPLAINED", "SUPPRESSED"].includes(req.body?.status) ? req.body.status : "SUPPRESSED";
  const subscriber = getSubscriptionRepository().suppressSubscriber(req.params.id, status);
  if (!subscriber) return res.status(404).json({ error: "subscriber_not_found" });
  res.json({ status: "suppressed", subscriber: { ...subscriber, email: maskEmail(subscriber.email) } });
});

app.post("/api/v1/automation/manual-review/:id/:action", adminLimiter, adminAuth, express.json({ limit: MAX_JSON_BODY, strict: true }), async (req, res) => {
  const allowed = new Set(["approve", "edit", "reject", "merge", "rescan", "unpublish", "archive", "trust-source"]);
  if (!allowed.has(req.params.action)) return res.status(400).json({ error: "unsupported_action" });
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  const items = state.manualReviewQueue || [];
  const index = items.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "review_item_not_found" });
  items[index] = {
    ...items[index],
    status: req.params.action,
    note: normalizeBoundedText(req.body?.note || "", 1000),
    updatedAt: new Date().toISOString(),
  };
  state.manualReviewQueue = items;
  await saveAutomationState(AUTOMATION_STATE_PATH, state);
  res.json({ item: items[index] });
});

app.post("/api/v1/automation/sources/:id/refresh", refreshLimiter, adminAuth, async (req, res) => {
  const source = SOURCE_REGISTRY.find((item) => item.id === req.params.id);
  if (!source) return res.status(404).json({ error: "source_not_found", requestId: req.requestId });
  const queued = await enqueueAutomationRefresh({ statePath: AUTOMATION_STATE_PATH, sourceId: source.id });
  callCache = null;
  return res.json({
    data: { sourceId: source.id, queuedAt: queued.fetchedAt, queued: queued.queued },
    meta: { generatedAt: new Date().toISOString(), requestId: req.requestId },
  });
});

app.get("/api/v1/calendar", async (req, res) => {
  const payload = await getCachedCalls();
  res.json({ events: filterCalls(payload.calls, req.query).map((call) => ({ id: call.id, title: call.title, deadline: call.deadline, url: call.url })) });
});

app.get("/api/v1/search/suggestions", async (req, res) => {
  const payload = await getCachedCalls();
  const q = normalizeWhitespace(req.query.q || "").toLocaleLowerCase("tr-TR");
  const suggestions = payload.calls
    .filter((call) => !q || `${call.title} ${call.funder}`.toLocaleLowerCase("tr-TR").includes(q))
    .slice(0, 10)
    .map((call) => ({ id: call.id, title: call.title, funder: call.funder }));
  res.json({ suggestions });
});

app.get("/api/v1/funding-database", (_req, res) => {
  res.json({ items: GLOBAL_FUNDING_DATABASE });
});

app.post("/api/v1/match", matchLimiter, express.json({ limit: MAX_JSON_BODY, strict: true }), async (req, res) => {
  const payload = await getCachedCalls();
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const preferredScopes = Array.isArray(body.preferredScopes) ? body.preferredScopes.slice(0, 10).map(scopeFromParam) : [];
  const themes = Array.isArray(body.themes) ? body.themes.slice(0, 20).map((theme) => normalizeBoundedText(theme, 100)).filter(Boolean) : [];
  const globalFunding = matchGlobalFundingDatabase(body);
  const calls = payload.calls
    .filter((call) => call.status === "open")
    .filter((call) => !preferredScopes.length || preferredScopes.includes(call.scope))
    .filter((call) => !themes.length || themes.some((theme) => `${call.category} ${call.title}`.toLocaleLowerCase("tr-TR").includes(String(theme).toLocaleLowerCase("tr-TR"))))
    .slice(0, 50);
  res.json({ calls, globalFunding, saved: false });
});

app.get("/api/v1/calls/:id/calendar.ics", async (req, res) => {
  const payload = await getCachedCalls();
  const call = findPublicCall(payload.calls, decodeURIComponent(req.params.id));
  if (!call) return res.status(404).send("Not found");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${slug(call.id).replace(/[^a-z0-9-]/gi, "") || "cagri"}.ics"`);
  res.send(makeIcs(call));
});

async function exportCalls(req, res, format) {
  const payload = await getCachedCalls();
  const rows = exportRows(filterCalls(payload.calls, req.query));
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"cagrilar.csv\"");
    return res.send(`\uFEFF${toCsv(rows)}`);
  }
  if (format === "xlsx") {
    const buffer = await makeXlsx(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"cagrilar.xlsx\"");
    return res.send(buffer);
  }
  const buffer = await makePdf(rows);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"cagrilar.pdf\"");
  return res.send(buffer);
}

app.get("/api/v1/exports/calls.csv", exportLimiter, (req, res) => exportCalls(req, res, "csv"));
app.get("/api/v1/exports/calls.xlsx", exportLimiter, (req, res) => exportCalls(req, res, "xlsx"));
app.get("/api/v1/exports/calls.pdf", exportLimiter, (req, res) => exportCalls(req, res, "pdf"));

app.get(["/rss/all.xml", "/rss/tum-cagrilar.xml"], async (req, res) => {
  const payload = await getCachedCalls();
  res.type("application/rss+xml").send(rssXml("Tüm Çağrılar", payload.calls, req));
});

app.get(["/rss/new.xml", "/rss/yeni-cagrilar.xml"], async (req, res) => {
  const payload = await getCachedCalls();
  const calls = payload.calls.slice().sort((a, b) => dateMs(b.publishedAt) - dateMs(a.publishedAt));
  res.type("application/rss+xml").send(rssXml("Yeni Çağrılar", calls, req));
});

app.get(["/rss/closing-soon.xml", "/rss/yakinda-kapananlar.xml"], async (req, res) => {
  const payload = await getCachedCalls();
  const calls = filterCalls(payload.calls, { status: "open", deadlineWithin: 30 });
  res.type("application/rss+xml").send(rssXml("Yakında Kapananlar", calls, req));
});

app.get("/rss/uluslararasi.xml", async (req, res) => {
  const payload = await getCachedCalls();
  res.type("application/rss+xml").send(rssXml("Uluslararası Çağrılar", filterCalls(payload.calls, { scope: "international" }), req));
});

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    cacheAgeMs: callCache ? Date.now() - callCache.cachedAtMs : null,
    cacheTtlMs: CACHE_TTL_MS,
    automation: callCache?.payload?.automation?.metrics || null,
  });
});

app.get("/readyz", async (_req, res) => {
  try {
    await loadAutomationState(AUTOMATION_STATE_PATH);
    res.json({ ok: true, cacheReady: Boolean(callCache), checkedAt: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, error: "readiness_failed" });
  }
});

app.get("/metrics", (_req, res) => {
  const snapshot = metricsSnapshot({
    cache: {
      ageMs: callCache ? Date.now() - callCache.cachedAtMs : null,
      ttlMs: CACHE_TTL_MS,
    },
    automation: callCache?.payload?.automation?.metrics || null,
  });
  res.type("text/plain; version=0.0.4; charset=utf-8").send(prometheusMetrics(snapshot));
});

app.use("/api", errorHandler);
app.use("/rss", errorHandler);

if (isProd) {
  app.use(
    express.static(path.join(root, "dist"), {
      etag: true,
      immutable: true,
      maxAge: MAX_AGE_IMMUTABLE,
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
  app.get(/.*/, (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
} else {
  const { readFile } = await import("node:fs/promises");
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
    root,
  });
  app.use(vite.middlewares);
  app.get(/.*/, async (req, res, next) => {
    try {
      const html = await readFile(path.join(root, "index.html"), "utf8");
      res.status(200).set({ "Content-Type": "text/html" }).send(await vite.transformIndexHtml(req.originalUrl, html));
    } catch (error) {
      vite.ssrFixStacktrace(error);
      next(error);
    }
  });
}

const server = app.listen(PORT, HOST, () => {
  console.log(`Hibe Rota running at http://${HOST}:${PORT}`);
  scheduleHourlyRefresh();
});

function shutdown(signal) {
  console.log(`${signal} received, closing server.`);
  if (hourlyRefreshTimer) clearTimeout(hourlyRefreshTimer);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
