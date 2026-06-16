import express from "express";
import compression from "compression";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import {
  AutomationQueue,
  JOB_TYPES,
  SOURCE_REGISTRY,
  buildAutomationMetrics,
  buildManualReviewItems,
  createSourceAdapters,
  dedupeAndFlag,
  detectChanges,
  loadAutomationState,
  mergeManualReviewQueue,
  saveAutomationState,
  updateSourceHealth,
  verifyLinks,
} from "./automation.mjs";
import { createScraperStrategies } from "./scrapers/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
const PORT = Number(process.env.PORT || 5173);
const isProd = process.env.NODE_ENV === "production";
const HOST = process.env.HOST || (isProd ? "0.0.0.0" : "127.0.0.1");
const HOUR_MS = 60 * 60 * 1000;
const CACHE_TTL_MS = Number(process.env.CALL_CACHE_TTL_MS || HOUR_MS);
const SOURCE_TIMEOUT_MS = Number(process.env.SOURCE_TIMEOUT_MS || 12000);
const MAX_AGE_IMMUTABLE = "1y";
const AUTOMATION_STATE_PATH = process.env.AUTOMATION_STATE_PATH || path.join(root, ".hiberota", "automation-state.json");

const USER_AGENT =
  process.env.SOURCE_USER_AGENT || "ProjeYakalama/1.0 (+project-call-monitor; contact: admin@example.com)";

let callCache = null;
let callCachePromise = null;
let hourlyRefreshTimer = null;
const automationQueue = new AutomationQueue({ concurrency: Number(process.env.CRAWLER_CONCURRENCY || 2) });

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

function absoluteUrl(base, href) {
  try {
    return new URL(href || base, base).toString();
  } catch {
    return base;
  }
}

function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeQualityText(value = "") {
  return normalizeWhitespace(value).toLocaleLowerCase("tr-TR");
}

const NON_APPLICATION_PATTERNS = [
  /sonu[çc](?:lar[ıi])?\s+a[çc][ıi]kland[ıi]/i,
  /ba[şs]vuru\s+sonu[çc](?:lar[ıi])?/i,
  /[öo]n\s+de[ğg]erlendirme/i,
  /de[ğg]erlendirme\s+raporu/i,
  /raporu\s+sonu[çc](?:lar[ıi])?/i,
  /sonu[çc]land[ıi]/i,
  /son\s+a[şs]amaya\s+ge[çc]ildi/i,
  /kazanan(?:lar)?/i,
  /finalist(?:ler)?/i,
  /(?:^|\s)[öo]d[üu]l(?:\s|$|ler|leri|[üu])/i,
  /etkinlik/i,
  /e[ğg]itim/i,
  /webinar/i,
];

const APPLICATION_SIGNAL_PATTERNS = [
  /son\s+ba[şs]vuru/i,
  /ba[şs]vur(?:u|ular)\s+(?:a[çc][ıi]ld[ıi]|al[ıi]nacak|ba[şs]lad[ıi]|devam\s+ediyor)/i,
  /ba[şs]vuruya\s+a[çc][ıi](?:k|ld[ıi])/i,
  /[çc]a[ğg]r[ıi](?:s[ıi])?\s+(?:a[çc][ıi]ld[ıi]|yay[ıi]mland[ıi]|duyuruldu)/i,
  /deadline/i,
  /call\s+for/i,
  /open\s+call/i,
  /\bhibe\b/i,
];

function isNonApplicationAnnouncement(call) {
  const text = normalizeQualityText(`${call.title || ""} ${call.summary || ""} ${call.source || ""}`);
  return NON_APPLICATION_PATTERNS.some((pattern) => pattern.test(text));
}

function hasApplicationSignal(call) {
  if (call.deadline) return true;
  const text = normalizeQualityText(`${call.title || ""} ${call.summary || ""} ${call.source || ""}`);
  return APPLICATION_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function slug(value) {
  return normalizeWhitespace(value)
    .toLowerCase("tr")
    .replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseDateLoose(value) {
  if (!value) return null;
  const clean = normalizeWhitespace(value);
  const months = {
    ocak: 0,
    subat: 1,
    şubat: 1,
    mart: 2,
    nisan: 3,
    mayis: 4,
    mayıs: 4,
    haziran: 5,
    temmuz: 6,
    agustos: 7,
    ağustos: 7,
    eylul: 8,
    eylül: 8,
    ekim: 9,
    kasim: 10,
    kasım: 10,
    aralik: 11,
    aralık: 11,
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  let match = clean.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))).toISOString();
  match = clean.match(/\b(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(20\d{2})\b/i);
  if (match) {
    const month = months[match[2].toLocaleLowerCase("tr-TR")];
    if (month !== undefined) return new Date(Date.UTC(Number(match[3]), month, Number(match[1]))).toISOString();
  }
  match = clean.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (match) {
    const month = months[match[1].toLowerCase()];
    if (month !== undefined) return new Date(Date.UTC(Number(match[3]), month, Number(match[2]))).toISOString();
  }
  return null;
}

function parseUsDate(value) {
  const match = normalizeWhitespace(value).match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (!match) return parseDateLoose(value);
  return new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]))).toISOString();
}

function decodeEntities(value = "") {
  return cheerio.load(`<span>${value}</span>`)("span").text();
}

function extractMoney(text) {
  const match = normalizeWhitespace(text).match(
    /((?:€|EUR|₺|TL|\$|USD)\s?[\d.,]+(?:\s?(?:milyon|million|billion|milyar))?|[\d.,]+\s?(?:€|EUR|₺|TL|\$|USD)(?:\s?(?:milyon|million|billion|milyar))?)/i,
  );
  return match ? match[1] : "";
}

function classifyScope(source, title = "") {
  const value = `${source} ${title}`.toLocaleLowerCase("tr-TR");
  if (value.includes("tübitak") || value.includes("tuseb") || value.includes("kosgeb")) return "Ulusal";
  if (value.includes("ufuk") || value.includes("horizon") || value.includes("eureka") || value.includes("euro")) return "Avrupa";
  return "Yurtdışı";
}

function statusFromDeadline(deadline) {
  if (!deadline) return "upcoming";
  const lastMoment = new Date(deadline);
  lastMoment.setHours(23, 59, 59, 999);
  return lastMoment.getTime() >= Date.now() ? "open" : "closed";
}

function qualityGateCalls(items) {
  const rejected = [];
  const calls = [];
  const manualReviewCalls = [];
  for (const call of items) {
    let reason = "";
    if (isNonApplicationAnnouncement(call)) reason = "announcement_or_result";
    else if (!hasApplicationSignal(call)) reason = "missing_application_deadline";
    else if (call.reviewStatus === "rejected" || call.isAccepted === false) reason = "low_institution_confidence";

    if (reason) {
      rejected.push({ id: call.id, title: call.title, source: call.source, reason });
    } else {
      const status = !call.deadline && call.status !== "closed" && hasApplicationSignal(call) ? "open" : call.status;
      const confidence = !call.deadline && status === "open" && call.confidence !== "yüksek" ? "kontrol" : call.confidence;
      const normalized = { ...call, status, confidence };
      if (normalized.isPublished) calls.push(normalized);
      else manualReviewCalls.push(normalized);
    }
  }
  return { calls, manualReviewCalls, rejected };
}

async function getHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function scrapeTubitak() {
  const sourceUrl = "https://tubitak.gov.tr/tr/duyuru";
  const html = await getHtml(sourceUrl);
  const $ = cheerio.load(html);
  const items = [];

  $(".view-content .views-row").each((_, row) => {
    const $row = $(row);
    const $link = $row.find(".views-field-title a[href]").first();
    const title = normalizeWhitespace($link.text());
    if (!/(çağrı|başvuru|hibe|destek\s+program|destek\s+çağr|programı\s+başvuru|proje\s+çağr)/i.test(title) || title.length < 18) return;
    const href = absoluteUrl(sourceUrl, $link.attr("href"));
    const context = normalizeWhitespace($row.text());
    const summary = normalizeWhitespace($row.find(".views-field-field-ozet").text()) || context;
    if (isNonApplicationAnnouncement({ title, summary, source: "TÜBİTAK Duyurular" })) return;
    const deadlineMatch = context.match(/(?:son başvuru|başvurular|deadline)[^.;:]*[: ]\s*([^.;]{6,40})/i);
    const deadline = deadlineMatch ? parseDateLoose(deadlineMatch[1]) : null;
    const publishedAt =
      $row.find("time[datetime]").first().attr("datetime") || parseDateLoose($row.find(".views-field-created").text());
    items.push({
      id: `tubitak-${slug(title)}`,
      title,
      funder: "TÜBİTAK",
      source: "TÜBİTAK Duyurular",
      scope: classifyScope("TÜBİTAK", title),
      category: "Proje/Ar-Ge desteği",
      support: extractMoney(context) || "Duyuru detayında belirtilir",
      deadline,
      publishedAt,
      status: statusFromDeadline(deadline),
      url: href,
      summary: summary.slice(0, 260),
      confidence: deadline ? "yüksek" : "orta",
    });
  });
  return dedupe(items).slice(0, 30);
}

async function scrapeUfukAvrupa() {
  const sourceUrl = "https://ufukavrupa.org.tr/tr";
  const html = await getHtml(sourceUrl);
  const $ = cheerio.load(html);
  const text = normalizeWhitespace($("body").text());
  const items = [];
  const pattern = /Son Başvuru:\s*\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+20\d{2}/gi;
  for (const match of text.matchAll(pattern)) {
    const start = Math.max(0, match.index - 180);
    const chunk = normalizeWhitespace(text.slice(start, match.index + match[0].length));
    const deadline = parseDateLoose(match[0]);
    const beforeDeadline = chunk.replace(/Son Başvuru:.*/i, "").trim();
    const title = beforeDeadline
      .split(/\s(?=[A-ZÇĞİÖŞÜ0-9][^.!?]{15,}(?:Çağr|Destek|Program|HORIZON))/)
      .pop()
      .trim();
    if (!title || !/(çağrı|destek|horizon|eit|eic|euro|avrupa)/i.test(title)) continue;
    items.push({
      id: `ufuk-${slug(title)}`,
      title,
      funder: "Ufuk Avrupa / AB",
      source: "Ufuk Avrupa Türkiye",
      scope: "Avrupa",
      category: "AB araştırma ve inovasyon",
      support: extractMoney(chunk) || "Çağrı dokümanında belirtilir",
      deadline,
      publishedAt: null,
      status: statusFromDeadline(deadline),
      url: sourceUrl,
      summary: chunk,
      confidence: deadline ? "yüksek" : "orta",
    });
  }
  return dedupe(items).slice(0, 15);
}

async function scrapeEureka() {
  const sourceUrl = "https://www.eurekanetwork.org/programmes-and-calls/";
  const html = await getHtml(sourceUrl);
  const $ = cheerio.load(html);
  const items = [];

  $("h3").each((_, h3) => {
    const title = normalizeWhitespace($(h3).text());
    if (!title || /^(calls|open calls)$/i.test(title) || /select your options|programmes|insights|about us/i.test(title)) return;
    const card = $(h3).closest(".relative, article, .rounded-lg");
    const context = normalizeWhitespace(card.text() || $(h3).parent().text());
    const deadline = parseDateLoose(context.match(/Deadline:\s*([^|+]+)/i)?.[1] || context);
    if (!deadline && !/call|challenge|projects|session/i.test(title)) return;
    const href = absoluteUrl(sourceUrl, card.find("a[href]").last().attr("href"));
    items.push({
      id: `eureka-${slug(title)}`,
      title,
      funder: "Eureka Network",
      source: "Eureka Open Funding Opportunities",
      scope: "Avrupa",
      category: context.match(/(Network Projects|Eurostars|Globalstars|Investment Readiness|Clusters)/i)?.[1] || "Uluslararası Ar-Ge",
      support: "Ulusal ajansa ve çağrıya göre değişir",
      deadline,
      publishedAt: null,
      status: statusFromDeadline(deadline),
      url: href || sourceUrl,
      summary: context.slice(0, 260),
      confidence: deadline ? "yüksek" : "orta",
    });
  });
  return dedupe(items).slice(0, 30);
}

async function scrapeEuresearchOpenCalls() {
  const sourceUrl = "https://www.euresearch.ch/en/our-services/inform/open-calls-137.html";
  const html = await getHtml(sourceUrl);
  const $ = cheerio.load(html);
  const items = [];

  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, cell) => normalizeWhitespace($(cell).text()))
      .get();
    if (cells.length < 3) return;
    const [topic, openDateText, deadlineText] = cells;
    const deadline = parseDateLoose(deadlineText);
    if (!topic || !deadline || statusFromDeadline(deadline) !== "open") return;
    const code = topic.match(/^[A-Z0-9-]+/)?.[0] || "";
    const title = topic.replace(code, "").trim() || topic;
    const href = absoluteUrl(sourceUrl, $(row).find("a[href]").first().attr("href"));
    items.push({
      id: `euresearch-${slug(code || title)}`,
      externalId: code,
      title: code ? `${code} ${title}` : title,
      funder: "Horizon Europe",
      source: "Euresearch Horizon Europe Open Calls",
      scope: "Avrupa",
      category: "Horizon Europe çağrı konusu",
      support: "Çağrı dokümanında belirtilir",
      deadline,
      publishedAt: parseDateLoose(openDateText),
      status: "open",
      url: href || sourceUrl,
      summary: `${code || "Horizon Europe"} çağrısı. Açılış: ${openDateText}. Son başvuru: ${deadlineText}.`,
      confidence: "yüksek",
    });
  });

  return dedupe(items).slice(0, 120);
}

async function scrapeEuroAccessCalls() {
  const sourceUrl = "https://euro-access.eu/en-us/calls";
  const html = await getHtml(sourceUrl);
  const $ = cheerio.load(html);
  const items = [];

  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((__, cell) => normalizeWhitespace($(cell).text()))
      .get();
    if (cells.length < 3) return;
    const [programme, title, deadlineText] = cells;
    const deadline = parseDateLoose(deadlineText);
    if (!programme || !title || !deadline || statusFromDeadline(deadline) !== "open") return;
    const href = absoluteUrl(sourceUrl, $(row).find("a[href]").first().attr("href"));
    items.push({
      id: `euroaccess-${slug(`${programme}-${title}`)}`,
      title,
      funder: programme,
      source: "EuroAccess EU Funding Calls",
      scope: "Avrupa",
      category: "AB fon çağrısı",
      support: "Çağrı detayında belirtilir",
      deadline,
      publishedAt: null,
      status: "open",
      url: href || sourceUrl,
      summary: `${programme} programı açık çağrısı. Son başvuru: ${deadlineText}.`,
      confidence: "orta",
    });
  });

  return dedupe(items).slice(0, 80);
}

async function scrapeGrantsGov() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  const response = await fetch("https://api.grants.gov/v1/api/search2", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({
      rows: 25,
      keyword: "research innovation technology",
      oppStatuses: "forecasted|posted",
      sortBy: "closeDate|asc",
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = await response.json();
  const hits = payload?.data?.oppHits || [];
  return hits.map((hit) => ({
    id: `grantsgov-${hit.id}`,
    externalId: hit.number,
    title: normalizeWhitespace(decodeEntities(hit.title)),
    funder: hit.agencyName || hit.agency || hit.agencyCode || "Grants.gov",
    source: "Grants.gov Search2 API",
    scope: "Yurtdışı",
    category: "ABD federal hibe",
    support: "Detay sayfasında belirtilir",
    deadline: parseUsDate(hit.closeDate),
    publishedAt: parseUsDate(hit.openDate),
    status: hit.oppStatus === "forecasted" ? "upcoming" : statusFromDeadline(parseUsDate(hit.closeDate)),
    url: `https://www.grants.gov/search-results-detail/${hit.id}`,
    summary: `${hit.number || ""} ${hit.agencyCode || ""} ${hit.alnist?.join(", ") || ""}`.trim(),
    confidence: "yüksek",
  }));
}

async function scrapeTuseb() {
  const sourceUrl = "https://tbys.tuseb.gov.tr/";
  const html = await getHtml(sourceUrl);
  const $ = cheerio.load(html);
  const text = normalizeWhitespace($("body").text());
  const items = [];
  const matches = text.matchAll(/(20\d{2}[^₺]{8,90}?(?:PROJE|AR-GE|DESTEK)[^₺]{0,140}?₺[\d.,]+)/gi);
  for (const match of matches) {
    const chunk = normalizeWhitespace(match[1]);
    items.push({
      id: `tuseb-${slug(chunk)}`,
      title: chunk.replace(/₺.*/, "").slice(0, 140),
      funder: "TÜSEB",
      source: "TÜSEB TBYS",
      scope: "Ulusal",
      category: "Sağlık Ar-Ge",
      support: extractMoney(chunk),
      deadline: parseDateLoose(chunk),
      publishedAt: null,
      status: statusFromDeadline(parseDateLoose(chunk)),
      url: sourceUrl,
      summary: chunk,
      confidence: "orta",
    });
  }
  if (!items.length) {
    items.push({
      id: "tuseb-portal",
      title: "TÜSEB aktif çağrı listesi",
      funder: "TÜSEB",
      source: "TÜSEB TBYS",
      scope: "Ulusal",
      category: "Sağlık Ar-Ge",
      support: "Aktif çağrı listesinde gösterilir",
      deadline: null,
      publishedAt: null,
      status: "open",
      url: sourceUrl,
      summary: "TÜSEB TBYS portalında aktif çağrı listesi bulunur; SPA içerik yapısı nedeniyle detaylar portal üzerinde doğrulanmalıdır.",
      confidence: "kontrol",
    });
  }
  return items.slice(0, 10);
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || `${item.title}-${item.deadline}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function collectCalls() {
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  const adapters = createSourceAdapters(createScraperStrategies());
  const errors = [];
  const calls = [];
  await Promise.all(
    adapters.map(async (adapter) => {
      const started = Date.now();
      automationQueue.enqueue({
        type: JOB_TYPES.DISCOVER_SOURCE,
        sourceId: adapter.id,
        url: adapter.listUrls[0],
        priority: adapter.sourceType === "official" ? 1 : 3,
      });
      try {
        const rawItems = await adapter.extractStructuredData();
        rawItems.forEach((item) => {
          if (item?.url) {
            automationQueue.enqueue({
              type: JOB_TYPES.FETCH_DETAIL_PAGE,
              sourceId: adapter.id,
              url: item.url,
              priority: adapter.sourceType === "official" ? 2 : 4,
              payload: { listItemId: item.id },
            });
          }
        });
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
  calls.sort((a, b) => {
    const ax = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bx = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    return ax - bx;
  });
  const unique = dedupe(calls);
  const quality = qualityGateCalls(unique);
  const acceptedCalls = [...quality.calls, ...quality.manualReviewCalls];
  const duplicateResult = dedupeAndFlag(acceptedCalls);
  const previousCalls = state.calls || {};
  const changeLogs = detectChanges(previousCalls, duplicateResult.calls);
  const linkHealthChecks = await verifyLinks(duplicateResult.calls);
  const reviewItems = buildManualReviewItems(duplicateResult.calls, duplicateResult.duplicates, linkHealthChecks);
  state.calls = Object.fromEntries(duplicateResult.calls.map((call) => [call.id, call]));
  state.duplicates = duplicateResult.duplicates;
  state.callChangeLogs = [...(state.callChangeLogs || []), ...changeLogs].slice(-1000);
  state.linkHealthChecks = [...(state.linkHealthChecks || []), ...linkHealthChecks].slice(-1000);
  state.manualReviewQueue = mergeManualReviewQueue(state.manualReviewQueue || [], reviewItems);
  state.crawlerJobs = automationQueue.snapshot().processed;
  state.metrics = buildAutomationMetrics(state, duplicateResult.calls);
  await saveAutomationState(AUTOMATION_STATE_PATH, state);
  const publishedCalls = duplicateResult.calls.filter((call) => call.isPublished);
  return {
    calls: publishedCalls,
    errors,
    fetchedAt: new Date().toISOString(),
    quality: {
      rejected: quality.rejected.length,
      rejectedSamples: quality.rejected.slice(0, 10),
      duplicates: duplicateResult.duplicates.length,
      manualReviewPending: state.metrics.manualReviewPending,
      unpublished: duplicateResult.calls.length - publishedCalls.length,
    },
    automation: {
      statePath: AUTOMATION_STATE_PATH,
      sources: Object.values(state.sources || {}).length,
      metrics: state.metrics,
    },
  };
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

  callCachePromise = collectCalls()
    .then((payload) => {
      callCache = { payload, cachedAtMs: Date.now() };
      return payload;
    })
    .finally(() => {
      callCachePromise = null;
    });

  const payload = await callCachePromise;
  return { ...payload, cache: { status: force ? "forced-refresh" : "miss", ttlMs: CACHE_TTL_MS, ageMs: 0 } };
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

function scopeFromParam(value) {
  const map = {
    national: "Ulusal",
    ulusal: "Ulusal",
    turkey: "Ulusal",
    turkiye: "Ulusal",
    türkiye: "Ulusal",
    europe: "Avrupa",
    avrupa: "Avrupa",
    eu: "Avrupa",
    international: "Yurtdışı",
    uluslararasi: "Yurtdışı",
    uluslararası: "Yurtdışı",
    global: "Yurtdışı",
  };
  return map[String(value || "").toLocaleLowerCase("tr-TR")] || value;
}

function normalizeSearchText(value = "") {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function callSearchText(call) {
  return normalizeSearchText(
    [
      call.title,
      call.funder,
      call.institution,
      call.category,
      call.programme,
      call.categories?.join(" "),
      call.summary,
      call.source,
      call.scope,
      call.externalId,
      call.callCode,
      call.targetAudience?.join(" "),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function statusGroup(call) {
  const normalized = call.normalizedStatus || "";
  if (["OPEN", "CLOSING_SOON", "EXTENDED"].includes(normalized)) return "open";
  if (["UPCOMING", "ANNOUNCED"].includes(normalized)) return "upcoming";
  if (["CLOSED", "ARCHIVED", "CANCELLED", "RESULT_PUBLISHED"].includes(normalized)) return "closed";
  return call.status || "upcoming";
}

function categoryMatches(call, category) {
  if (!category) return true;
  return call.category === category || call.programme === category || (call.categories || []).includes(category);
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

function filterCalls(calls, query = {}) {
  const searchTerms = normalizeSearchText(query.q || query.search || "").split(" ").filter(Boolean);
  const scope = scopeFromParam(query.scope);
  const status = query.status || "open";
  const deadlineWithin = query.deadlineWithin ? Number(query.deadlineWithin) : null;
  const category = normalizeWhitespace(query.category || "");
  const funder = normalizeWhitespace(query.funder || "");
  const institution = normalizeWhitespace(query.institution || "");
  const program = normalizeWhitespace(query.program || "");
  const supportType = normalizeWhitespace(query.supportType || "");
  const targetGroup = normalizeSearchText(query.targetGroup || "");
  const thematicArea = normalizeSearchText(query.thematicArea || query.theme || "");
  const country = normalizeWhitespace(query.country || "");
  const currency = normalizeWhitespace(query.currency || "");
  const deadlineFrom = query.deadlineFrom ? new Date(query.deadlineFrom).getTime() : null;
  const deadlineTo = query.deadlineTo ? new Date(query.deadlineTo).getTime() : null;

  let result = calls.filter((call) => {
    const haystack = callSearchText(call);
    const left = daysUntil(call.deadline);
    const deadlineMs = call.deadline ? new Date(call.deadline).getTime() : null;
    return (
      (!searchTerms.length || searchTerms.every((term) => haystack.includes(term))) &&
      (!scope || scope === "Tümü" || call.scope === scope) &&
      (!status || status === "all" || statusGroup(call) === status) &&
      categoryMatches(call, category) &&
      (!funder || call.funder === funder) &&
      (!institution || call.institution === institution || call.funder === institution) &&
      (!program || call.programme === program || call.category === program) &&
      (!supportType || call.supportType === supportType || call.category === supportType) &&
      (!targetGroup || (call.targetAudience || []).some((item) => normalizeSearchText(item).includes(targetGroup)) || haystack.includes(targetGroup)) &&
      (!thematicArea || (call.categories || []).some((item) => normalizeSearchText(item).includes(thematicArea)) || haystack.includes(thematicArea)) &&
      (!country || call.country === country || (call.eligibleCountries || []).includes(country)) &&
      (!currency || call.currency === currency) &&
      (!deadlineFrom || (deadlineMs && deadlineMs >= deadlineFrom)) &&
      (!deadlineTo || (deadlineMs && deadlineMs <= deadlineTo)) &&
      (!deadlineWithin || (left !== null && left >= 0 && left <= deadlineWithin))
    );
  });

  if (query.sort === "deadline_desc") result = result.sort((a, b) => dateMs(b.deadline) - dateMs(a.deadline));
  else if (query.sort === "newest") result = result.sort((a, b) => dateMs(b.publishedAt) - dateMs(a.publishedAt));
  else result = result.sort((a, b) => dateMs(a.deadline) - dateMs(b.deadline));

  return result;
}

function dateMs(value) {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function daysUntil(value) {
  if (!value) return null;
  return Math.ceil((new Date(value).setHours(23, 59, 59, 999) - Date.now()) / 86400000);
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
    "Destek türü": call.category,
    "Destek miktarı": call.support,
    "Para birimi": call.support?.match(/€|EUR|₺|TL|\$|USD/i)?.[0] || "",
    "Hedef kitle": "",
    "Tematik alan": call.category,
    "Türkiye uygunluğu": call.scope === "Ulusal" || call.scope === "Avrupa" ? "Kontrol edilmeli" : "Kaynak detayında kontrol edilmeli",
    "Ortaklık şartı": "",
    "Resmî çağrı bağlantısı": call.url,
    "Başvuru bağlantısı": call.url,
    "Son kontrol tarihi": new Date().toISOString(),
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
    `UID:${call.id}@proje-yakalama`,
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

app.post("/api/calls/refresh", async (_req, res) => {
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

app.get("/api/v1/calls", async (req, res) => {
  const payload = await getCachedCalls();
  res.set("Cache-Control", "no-store");
  res.json({ ...payload, calls: filterCalls(payload.calls, req.query) });
});

app.get("/api/v1/calls/:id", async (req, res) => {
  const payload = await getCachedCalls();
  const call = payload.calls.find((item) => item.id === req.params.id);
  if (!call) return res.status(404).json({ error: "call_not_found" });
  return res.json(call);
});

app.get("/api/v1/calls/:id/similar", async (req, res) => {
  const payload = await getCachedCalls();
  const call = payload.calls.find((item) => item.id === req.params.id);
  if (!call) return res.status(404).json({ error: "call_not_found" });
  const similar = payload.calls
    .filter((item) => item.id !== call.id && (item.scope === call.scope || item.category === call.category || item.funder === call.funder))
    .slice(0, 12);
  return res.json({ calls: similar });
});

app.get("/api/v1/programmes", (_req, res) => {
  res.json({ programmes: [] });
});

app.get("/api/v1/programmes/:id", (req, res) => {
  res.status(404).json({ error: "programme_not_found", id: req.params.id });
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
  const payload = await getCachedCalls();
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  res.json({
    metrics: state.metrics || buildAutomationMetrics(state, payload.calls),
    quality: payload.quality || {},
    cache: payload.cache || {},
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

app.get("/api/v1/automation/jobs", (_req, res) => {
  res.json({ queue: automationQueue.snapshot(), supportedJobTypes: Object.values(JOB_TYPES) });
});

app.post("/api/v1/automation/manual-review/:id/:action", express.json(), async (req, res) => {
  const allowed = new Set(["approve", "edit", "reject", "merge", "rescan", "unpublish", "archive", "trust-source"]);
  if (!allowed.has(req.params.action)) return res.status(400).json({ error: "unsupported_action" });
  const state = await loadAutomationState(AUTOMATION_STATE_PATH);
  const items = state.manualReviewQueue || [];
  const index = items.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "review_item_not_found" });
  items[index] = {
    ...items[index],
    status: req.params.action,
    note: req.body?.note || "",
    updatedAt: new Date().toISOString(),
  };
  state.manualReviewQueue = items;
  await saveAutomationState(AUTOMATION_STATE_PATH, state);
  res.json({ item: items[index] });
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

app.post("/api/v1/match", express.json(), async (req, res) => {
  const payload = await getCachedCalls();
  const preferredScopes = (req.body?.preferredScopes || []).map(scopeFromParam);
  const themes = req.body?.themes || [];
  const calls = payload.calls
    .filter((call) => call.status === "open")
    .filter((call) => !preferredScopes.length || preferredScopes.includes(call.scope))
    .filter((call) => !themes.length || themes.some((theme) => `${call.category} ${call.title}`.toLocaleLowerCase("tr-TR").includes(String(theme).toLocaleLowerCase("tr-TR"))))
    .slice(0, 50);
  res.json({ calls, saved: false });
});

app.get("/api/v1/calls/:id/calendar.ics", async (req, res) => {
  const payload = await getCachedCalls();
  const call = payload.calls.find((item) => item.id === req.params.id);
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

app.get("/api/v1/exports/calls.csv", (req, res) => exportCalls(req, res, "csv"));
app.get("/api/v1/exports/calls.xlsx", (req, res) => exportCalls(req, res, "xlsx"));
app.get("/api/v1/exports/calls.pdf", (req, res) => exportCalls(req, res, "pdf"));

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
