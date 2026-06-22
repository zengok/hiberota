import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadStateFromDb, saveStateToDb } from "../db.mjs";
import { isSafeUrl } from "../security/url-safety.mjs";

export const JOB_TYPES = {
  DISCOVER_SOURCE: "DISCOVER_SOURCE",
  FETCH_LIST_PAGE: "FETCH_LIST_PAGE",
  FETCH_DETAIL_PAGE: "FETCH_DETAIL_PAGE",
  DOWNLOAD_DOCUMENT: "DOWNLOAD_DOCUMENT",
  PARSE_DOCUMENT: "PARSE_DOCUMENT",
  EXTRACT_CALL_DATA: "EXTRACT_CALL_DATA",
  VALIDATE_CALL: "VALIDATE_CALL",
  DETECT_DUPLICATE: "DETECT_DUPLICATE",
  DETECT_CHANGE: "DETECT_CHANGE",
  VERIFY_LINKS: "VERIFY_LINKS",
  PUBLISH_CALL: "PUBLISH_CALL",
  RECHECK_DEADLINE: "RECHECK_DEADLINE",
  ARCHIVE_CALL: "ARCHIVE_CALL",
};

export const PAGE_TYPES = {
  CALL_LIST: "CALL_LIST",
  CALL_DETAIL: "CALL_DETAIL",
  PROGRAM_DETAIL: "PROGRAM_DETAIL",
  NEWS: "NEWS",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  APPLICATION_GUIDE: "APPLICATION_GUIDE",
  APPLICATION_FORM: "APPLICATION_FORM",
  PDF_DOCUMENT: "PDF_DOCUMENT",
  DEADLINE_EXTENSION: "DEADLINE_EXTENSION",
  CANCELLATION: "CANCELLATION",
  RESULT_ANNOUNCEMENT: "RESULT_ANNOUNCEMENT",
  CLOSED_CALL: "CLOSED_CALL",
  IRRELEVANT: "IRRELEVANT",
  UNKNOWN: "UNKNOWN",
};

export const NORMALIZED_STATUSES = {
  DRAFT: "DRAFT",
  ANNOUNCED: "ANNOUNCED",
  UPCOMING: "UPCOMING",
  OPEN: "OPEN",
  CLOSING_SOON: "CLOSING_SOON",
  EXTENDED: "EXTENDED",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
  CLOSED: "CLOSED",
  RESULT_PUBLISHED: "RESULT_PUBLISHED",
  ARCHIVED: "ARCHIVED",
  UNKNOWN: "UNKNOWN",
};

export const LINK_STATUSES = {
  WORKING: "WORKING",
  REDIRECTED: "REDIRECTED",
  BROKEN: "BROKEN",
  FORBIDDEN: "FORBIDDEN",
  TIMEOUT: "TIMEOUT",
  UNKNOWN: "UNKNOWN",
};

export const AUTOMATION_CONFIG = {
  version: "1.0.0",
  defaultLanguage: "tr",
  defaultTimezone: "Europe/Istanbul",
  institutionDetectionThresholds: {
    automaticApproval: 80,
    manualReview: 50,
    rejectBelow: 50,
  },
  closingSoonDays: Number(process.env.CLOSING_SOON_DAYS || 7),
};

export const SOURCE_REGISTRY = [
  {
    id: "tubitak",
    name: "TÜBİTAK",
    baseUrl: "https://tubitak.gov.tr",
    listUrls: ["https://tubitak.gov.tr/tr/duyuru"],
    sourceType: "official",
    crawlMethod: "html",
    country: "TR",
    language: "tr",
    timezone: "Europe/Istanbul",
    crawlFrequencyMinutes: Number(process.env.CRAWL_FREQ_TUBITAK_MIN || 180),
    trustScore: 95,
    isActive: true,
    requiresJavascript: false,
    adapterName: "tubitak-adapter",
    config: { scope: "national", rateLimitMs: 1500 },
  },
  {
    id: "ufuk-avrupa",
    name: "Ufuk Avrupa Türkiye",
    baseUrl: "https://ufukavrupa.org.tr",
    listUrls: ["https://ufukavrupa.org.tr/tr"],
    sourceType: "official",
    crawlMethod: "html",
    country: "TR",
    language: "tr",
    timezone: "Europe/Istanbul",
    crawlFrequencyMinutes: Number(process.env.CRAWL_FREQ_EU_MIN || 120),
    trustScore: 90,
    isActive: true,
    requiresJavascript: false,
    adapterName: "european-commission-adapter",
    config: { scope: "europe", rateLimitMs: 1500 },
  },
  {
    id: "eureka",
    name: "Eureka Network",
    baseUrl: "https://www.eurekanetwork.org",
    listUrls: ["https://www.eurekanetwork.org/programmes-and-calls/"],
    sourceType: "official",
    crawlMethod: "html",
    country: "EU",
    language: "en",
    timezone: "Europe/Brussels",
    crawlFrequencyMinutes: Number(process.env.CRAWL_FREQ_EU_MIN || 120),
    trustScore: 90,
    isActive: true,
    requiresJavascript: false,
    adapterName: "eureka-adapter",
    config: { scope: "europe", rateLimitMs: 1500 },
  },
  {
    id: "euresearch",
    name: "Euresearch Horizon Europe Open Calls",
    baseUrl: "https://www.euresearch.ch",
    listUrls: ["https://www.euresearch.ch/en/our-services/inform/open-calls-137.html"],
    sourceType: "secondary",
    crawlMethod: "html",
    country: "CH",
    language: "en",
    timezone: "Europe/Zurich",
    crawlFrequencyMinutes: Number(process.env.CRAWL_FREQ_EU_MIN || 120),
    trustScore: 78,
    isActive: true,
    requiresJavascript: false,
    adapterName: "generic-html-adapter",
    config: { scope: "europe", rateLimitMs: 1500 },
  },
  {
    id: "euroaccess",
    name: "EuroAccess EU Funding Calls",
    baseUrl: "https://euro-access.eu",
    listUrls: ["https://euro-access.eu/en-us/calls"],
    sourceType: "secondary",
    crawlMethod: "html",
    country: "EU",
    language: "en",
    timezone: "Europe/Brussels",
    crawlFrequencyMinutes: Number(process.env.CRAWL_FREQ_EU_MIN || 120),
    trustScore: 76,
    isActive: true,
    requiresJavascript: false,
    adapterName: "generic-html-adapter",
    config: { scope: "europe", rateLimitMs: 1500 },
  },
  {
    id: "grants-gov",
    name: "Grants.gov",
    baseUrl: "https://api.grants.gov",
    listUrls: ["https://api.grants.gov/v1/api/search2"],
    sourceType: "official",
    crawlMethod: "api",
    country: "US",
    language: "en",
    timezone: "America/New_York",
    crawlFrequencyMinutes: Number(process.env.CRAWL_FREQ_INTL_MIN || 180),
    trustScore: 95,
    isActive: true,
    requiresJavascript: false,
    adapterName: "grants-gov-adapter",
    config: { scope: "international", rateLimitMs: 1500 },
  },
  {
    id: "tuseb",
    name: "TÜSEB",
    baseUrl: "https://tbys.tuseb.gov.tr",
    listUrls: ["https://tbys.tuseb.gov.tr/"],
    sourceType: "official",
    crawlMethod: "html",
    country: "TR",
    language: "tr",
    timezone: "Europe/Istanbul",
    crawlFrequencyMinutes: Number(process.env.CRAWL_FREQ_TUSEB_MIN || 240),
    trustScore: 90,
    isActive: true,
    requiresJavascript: true,
    adapterName: "tuseb-adapter",
    config: { scope: "national", rateLimitMs: 1500 },
  },
];

export const FUNDING_SOURCES = [
  {
    id: "tubitak",
    name: "Scientific and Technological Research Council of Türkiye",
    name_tr: "Türkiye Bilimsel ve Teknolojik Araştırma Kurumu",
    aliases: ["TÜBİTAK", "TUBITAK", "Türkiye Bilimsel ve Teknolojik Araştırma Kurumu", "Scientific and Technological Research Council of Türkiye"],
    official_domains: ["tubitak.gov.tr", "ufukavrupa.org.tr"],
    source_type: "national_public_institution",
    region: "Türkiye",
    country: "TR",
    programs: ["ARDEB", "TEYDEB", "BİDEB", "Ufuk Avrupa", "Eureka", "Eurostars", "ERA-NET", "İkili İş Birliği Programları"],
    detection_keywords: ["çağrı duyurusu", "başvuruya açıldı", "proje desteği", "destek programı", "son başvuru tarihi", "başvuru koşulları"],
    application_url_patterns: ["/tr/duyuru/", "/tr/cagrilar/", "/tr/destekler/", "/tr/haberler/"],
    priority: 100,
    active: true,
  },
  {
    id: "eu_commission",
    name: "European Commission",
    name_tr: "Avrupa Komisyonu",
    aliases: ["European Commission", "Avrupa Komisyonu", "EU Commission", "EC"],
    official_domains: ["commission.europa.eu", "ec.europa.eu", "funding-tenders.ec.europa.eu"],
    source_type: "international_public_institution",
    region: "European Union",
    country: null,
    programs: ["Horizon Europe", "Digital Europe Programme", "Erasmus+", "Single Market Programme", "LIFE Programme", "Creative Europe"],
    detection_keywords: ["call for proposals", "funding opportunity", "grant", "work programme", "application deadline", "submission deadline", "funding and tenders"],
    application_url_patterns: ["/funding-tenders/", "/calls-for-proposals/", "/funding/"],
    priority: 100,
    active: true,
  },
  {
    id: "eic",
    name: "European Innovation Council",
    name_tr: "Avrupa İnovasyon Konseyi",
    aliases: ["European Innovation Council", "EIC", "EIC Accelerator", "EIC Pathfinder", "EIC Transition", "EIC STEP Scale Up"],
    official_domains: ["eic.ec.europa.eu", "commission.europa.eu", "funding-tenders.ec.europa.eu"],
    source_type: "eu_program",
    region: "European Union",
    country: null,
    programs: ["EIC Accelerator", "EIC Pathfinder", "EIC Transition", "EIC STEP Scale Up"],
    detection_keywords: ["EIC call", "EIC Accelerator", "EIC Pathfinder", "EIC Transition", "open call", "challenge", "grant funding", "equity funding"],
    application_url_patterns: ["/eic-funding-opportunities/", "/funding-tenders/"],
    priority: 95,
    active: true,
  },
  {
    id: "rea",
    name: "European Research Executive Agency",
    name_tr: "Avrupa Araştırma Yürütme Ajansı",
    aliases: ["European Research Executive Agency", "REA"],
    official_domains: ["rea.ec.europa.eu", "commission.europa.eu", "funding-tenders.ec.europa.eu"],
    source_type: "eu_executive_agency",
    region: "European Union",
    country: null,
    programs: ["Horizon Europe", "Marie Skłodowska-Curie Actions", "Research Infrastructures"],
    detection_keywords: ["Horizon Europe call", "research grant", "MSCA", "research infrastructure", "call for proposals"],
    application_url_patterns: ["/funding-and-grants/", "/funding-tenders/"],
    priority: 90,
    active: true,
  },
  {
    id: "eureka",
    name: "Eureka Network",
    name_tr: "Eureka Ağı",
    aliases: ["Eureka", "Eureka Network", "Eureka Globalstars", "Eureka Network Projects", "Eurostars"],
    official_domains: ["eurekanetwork.org"],
    source_type: "international_network",
    region: "International",
    country: null,
    programs: ["Eurostars", "Network Projects", "Globalstars", "Eureka Clusters"],
    detection_keywords: ["Eureka call", "Eurostars call", "international R&D project", "network projects", "globalstars", "application deadline"],
    application_url_patterns: ["/programmes-and-calls/", "/open-calls/"],
    priority: 90,
    active: true,
  },
  {
    id: "turkish_national_agency",
    name: "Turkish National Agency",
    name_tr: "Türkiye Ulusal Ajansı",
    aliases: ["Türkiye Ulusal Ajansı", "Ulusal Ajans", "Turkish National Agency", "Avrupa Birliği Eğitim ve Gençlik Programları Merkezi Başkanlığı"],
    official_domains: ["ua.gov.tr"],
    source_type: "national_public_institution",
    region: "Türkiye",
    country: "TR",
    programs: ["Erasmus+", "European Solidarity Corps"],
    detection_keywords: ["teklif çağrısı", "Erasmus+ çağrısı", "hibe programı", "başvuru rehberi", "son başvuru tarihi"],
    application_url_patterns: ["/haberler/", "/duyurular/", "/programlar/"],
    priority: 95,
    active: true,
  },
  {
    id: "grants_gov",
    name: "Grants.gov",
    name_tr: "Grants.gov",
    aliases: ["Grants.gov", "Grants Gov", "US Federal Grants"],
    official_domains: ["grants.gov", "api.grants.gov"],
    source_type: "national_public_institution",
    region: "United States",
    country: "US",
    programs: ["Federal Assistance", "NIH", "NSF", "DOE", "USDA"],
    detection_keywords: ["opportunity number", "funding opportunity", "grants.gov", "application package", "closing date"],
    application_url_patterns: ["/search-results-detail/", "/opportunity/"],
    priority: 95,
    active: true,
  },
  {
    id: "tuseb",
    name: "Health Institutes of Türkiye",
    name_tr: "Türkiye Sağlık Enstitüleri Başkanlığı",
    aliases: ["TÜSEB", "TUSEB", "Türkiye Sağlık Enstitüleri Başkanlığı", "Health Institutes of Türkiye"],
    official_domains: ["tuseb.gov.tr", "tbys.tuseb.gov.tr"],
    source_type: "national_public_institution",
    region: "Türkiye",
    country: "TR",
    programs: ["Aziz Sancar Bilim", "Sağlık Ar-Ge", "B Grubu Ar-Ge"],
    detection_keywords: ["sağlık ar-ge", "proje çağrısı", "destek programı", "başvuru dönemi", "son başvuru tarihi"],
    application_url_patterns: ["/", "/proje/", "/duyuru/"],
    priority: 92,
    active: true,
  },
];

const STATE_VERSION = 1;

export function normalizeText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value = "") {
  return normalizeText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function contentHash(value = "") {
  return crypto.createHash("sha256").update(normalizeText(value), "utf8").digest("hex");
}

export function safeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function isSafeCrawlerUrl(value) {
  return isSafeUrl(value);
}

function sourceById(id) {
  return SOURCE_REGISTRY.find((source) => source.id === id) || null;
}

function fundingSourceById(id) {
  return FUNDING_SOURCES.find((source) => source.id === id) || null;
}

function extractHostname(value = "") {
  try {
    return new URL(value).hostname.toLocaleLowerCase("en-US");
  } catch {
    return "";
  }
}

function matchesOfficialDomain(urlOrDomain = "", officialDomains = []) {
  const hostname = urlOrDomain.includes("://") ? extractHostname(urlOrDomain) : String(urlOrDomain).toLocaleLowerCase("en-US");
  if (!hostname) return false;
  return officialDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function matchesPattern(url = "", patterns = []) {
  return patterns.some((pattern) => url.includes(pattern));
}

function countKeywordHits(text, keywords = []) {
  return keywords.reduce((count, keyword) => (text.includes(keyword.toLocaleLowerCase("tr-TR")) ? count + 1 : count), 0);
}

function buildCallContent(call = {}) {
  return normalizeText([
    call.title,
    call.originalTitle,
    call.summary,
    call.description,
    call.funder,
    call.institution,
    call.source,
    call.programme,
    call.category,
    call.callCode,
    call.externalId,
  ].filter(Boolean).join(" "));
}

function determineOfficialLinks(call, fundingSource, source) {
  const pageUrl = call.url || "";
  const applicationCandidate = call.applicationUrl || "";
  const officialCandidate = call.officialUrl || "";
  const sourceOfficial = source?.sourceType === "official";
  const pageIsOfficial = fundingSource ? matchesOfficialDomain(pageUrl, fundingSource.official_domains) : sourceOfficial;
  const officialUrl = officialCandidate && fundingSource && matchesOfficialDomain(officialCandidate, fundingSource.official_domains)
    ? officialCandidate
    : pageIsOfficial
      ? pageUrl
      : applicationCandidate && fundingSource && matchesOfficialDomain(applicationCandidate, fundingSource.official_domains)
        ? applicationCandidate
        : "";
  const applicationUrl = applicationCandidate && fundingSource && matchesOfficialDomain(applicationCandidate, fundingSource.official_domains)
    ? applicationCandidate
    : pageIsOfficial && fundingSource && matchesPattern(pageUrl, fundingSource.application_url_patterns)
      ? pageUrl
      : "";
  return { officialUrl, applicationUrl, pageIsOfficial };
}

export function matchFundingSource(call, { source = null } = {}) {
  const text = buildCallContent(call).toLocaleLowerCase("tr-TR");
  const urls = [call.url, call.officialUrl, call.applicationUrl].filter(Boolean);
  const sourceDomain = extractHostname(call.url || source?.baseUrl || "");
  const matches = FUNDING_SOURCES
    .filter((fundingSource) => fundingSource.active)
    .map((fundingSource) => {
      const domainMatched = matchesOfficialDomain(sourceDomain, fundingSource.official_domains);
      const aliasHits = countKeywordHits(text, fundingSource.aliases);
      const programHits = countKeywordHits(text, fundingSource.programs);
      const keywordHits = countKeywordHits(text, fundingSource.detection_keywords);
      const urlPatternHits = urls.some((url) => matchesPattern(url, fundingSource.application_url_patterns));
      const verifiedOfficialLink = urls.some((url) => matchesOfficialDomain(url, fundingSource.official_domains));
      let score = 0;
      if (domainMatched) score += 45;
      if (verifiedOfficialLink) score += 20;
      score += Math.min(18, aliasHits * 9);
      score += Math.min(14, programHits * 7);
      score += Math.min(10, keywordHits * 5);
      if (urlPatternHits) score += 8;
      if (source?.sourceType === "official" && domainMatched) score += 6;
      if (source?.sourceType === "secondary" && !verifiedOfficialLink) score -= 15;
      score += Math.min(8, Math.round((fundingSource.priority || 0) / 20));
      return {
        fundingSource,
        score: Math.max(0, Math.min(100, score)),
        domainMatched,
        aliasHits,
        programHits,
        keywordHits,
        urlPatternHits,
        verifiedOfficialLink,
      };
    })
    .sort((a, b) => b.score - a.score || (b.fundingSource.priority || 0) - (a.fundingSource.priority || 0));
  return matches[0] || {
    fundingSource: null,
    score: 0,
    domainMatched: false,
    aliasHits: 0,
    programHits: 0,
    keywordHits: 0,
    urlPatternHits: false,
    verifiedOfficialLink: false,
  };
}

function buildStructuredContentHash(call) {
  const signature = [
    normalizeText(call.title || ""),
    normalizeText(call.callCode || call.externalId || ""),
    normalizeText(call.institution || call.funder || ""),
    normalizeText(call.programme || call.category || ""),
    normalizeText(call.deadline || ""),
  ].join("|");
  return contentHash(signature);
}

function findPreviousCallRecord(previousCalls = {}, call = {}) {
  const previousList = Object.values(previousCalls || {});
  return previousList.find((previous) =>
    (call.contentHash && previous.contentHash === call.contentHash) ||
    (call.callCode && previous.callCode === call.callCode && previous.sourceId === call.sourceId) ||
    (call.officialUrl && previous.officialUrl === call.officialUrl) ||
    (call.title && previous.title === call.title && previous.deadline === call.deadline),
  ) || null;
}

function findSourceForCall(call) {
  const sourceText = `${call.source || ""} ${call.funder || ""}`.toLocaleLowerCase("tr-TR");
  if (sourceText.includes("tübitak")) return sourceById("tubitak");
  if (sourceText.includes("ufuk")) return sourceById("ufuk-avrupa");
  if (sourceText.includes("eureka")) return sourceById("eureka");
  if (sourceText.includes("euresearch")) return sourceById("euresearch");
  if (sourceText.includes("euroaccess")) return sourceById("euroaccess");
  if (sourceText.includes("grants.gov")) return sourceById("grants-gov");
  if (sourceText.includes("tüseb")) return sourceById("tuseb");
  return null;
}

export function classifyPageType({ title = "", text = "", url = "" } = {}) {
  const haystack = `${title} ${text} ${url}`.toLocaleLowerCase("tr-TR");
  const pdf = /\.pdf(?:$|[?#])/i.test(url);
  if (pdf) return { pageType: PAGE_TYPES.PDF_DOCUMENT, confidence: 0.98 };
  if (/(sonu[çc](?:lar[ıi])?\s+a[çc][ıi]kland[ıi]|[öo]n\s+de[ğg]erlendirme|kazanan|finalist)/i.test(haystack)) return { pageType: PAGE_TYPES.RESULT_ANNOUNCEMENT, confidence: 0.96 };
  if (/(iptal\s+edil|cancelled|canceled)/i.test(haystack)) return { pageType: PAGE_TYPES.CANCELLATION, confidence: 0.95 };
  if (/(s[üu]re\s+uzat[ıi]ld[ıi]|ba[şs]vuru\s+takvimi\s+g[üu]ncell|ileri\s+bir\s+tarihe\s+al[ıi]n|deadline\s+extended|extension\s+of\s+deadline)/i.test(haystack)) return { pageType: PAGE_TYPES.DEADLINE_EXTENSION, confidence: 0.95 };
  if (/(ba[şs]vuru\s+formu|application\s+form)/i.test(haystack)) return { pageType: PAGE_TYPES.APPLICATION_FORM, confidence: 0.9 };
  if (/(ba[şs]vuru\s+rehberi|uygulama\s+esaslar[ıi]|application\s+guide|guideline)/i.test(haystack)) return { pageType: PAGE_TYPES.APPLICATION_GUIDE, confidence: 0.88 };
  if (/(a[çc][ıi]k\s+[çc]a[ğg]r[ıi]|son\s+ba[şs]vuru|open\s+call|call\s+for\s+proposals|funding\s+opportunity|deadline)/i.test(haystack)) return { pageType: PAGE_TYPES.CALL_DETAIL, confidence: 0.86 };
  if (/(duyuru|announcement|news|haber)/i.test(haystack)) return { pageType: PAGE_TYPES.ANNOUNCEMENT, confidence: 0.7 };
  if (/(program|programme|support programme|destek)/i.test(haystack)) return { pageType: PAGE_TYPES.PROGRAM_DETAIL, confidence: 0.64 };
  return { pageType: PAGE_TYPES.UNKNOWN, confidence: 0.35 };
}

export function parseImportantDates(text = "", { timezone = "Europe/Istanbul" } = {}) {
  const clean = normalizeText(text);
  const monthMap = {
    ocak: 1,
    subat: 2,
    şubat: 2,
    mart: 3,
    nisan: 4,
    mayis: 5,
    mayıs: 5,
    haziran: 6,
    temmuz: 7,
    agustos: 8,
    ağustos: 8,
    eylul: 9,
    eylül: 9,
    ekim: 10,
    kasim: 11,
    kasım: 11,
    aralik: 12,
    aralık: 12,
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  const results = [];
  const add = (type, year, month, day, rawText, confidence = 0.86) => {
    if (!year || !month || !day) return;
    const raw = normalizeText(rawText);
    const timeMatch = raw.match(/(?:saat|at)?\s*(\d{1,2})[:.](\d{2})\s*(CET|CEST|UTC|GMT)?/i);
    const time = timeMatch ? `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}` : null;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    results.push({ type, date, time, timezone: timeMatch?.[3] || timezone, rawText: raw, confidence });
  };
  for (const match of clean.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})(?:[^.;,\n]{0,25})?/g)) {
    const raw = clean.slice(match.index, Math.min(clean.length, match.index + 90));
    add(inferDateType(clean, match.index), Number(match[3]), Number(match[2]), Number(match[1]), raw, 0.94);
  }
  for (const match of clean.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})(?:[^.;,\n]{0,25})?/g)) {
    add(inferDateType(clean, match.index), Number(match[1]), Number(match[2]), Number(match[3]), clean.slice(match.index, Math.min(clean.length, match.index + 90)), 0.94);
  }
  for (const match of clean.matchAll(/\b(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(20\d{2})(?:[^.;,\n]{0,35})?/g)) {
    const month = monthMap[match[2].toLocaleLowerCase("tr-TR")];
    add(inferDateType(clean, match.index), Number(match[3]), month, Number(match[1]), clean.slice(match.index, Math.min(clean.length, match.index + 90)), 0.92);
  }
  for (const match of clean.matchAll(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(20\d{2})(?:[^.;,\n]{0,35})?/g)) {
    const month = monthMap[match[1].toLocaleLowerCase("en-US")];
    add(inferDateType(clean, match.index), Number(match[3]), month, Number(match[2]), clean.slice(match.index, Math.min(clean.length, match.index + 90)), 0.9);
  }
  return dedupeDates(results);
}

function inferDateType(text, index = 0) {
  const window = text.slice(Math.max(0, index - 80), index + 120).toLocaleLowerCase("tr-TR");
  if (/(son\s+ba[şs]vuru|deadline|full\s+application|ba[şs]vurular?.*(kadar|al[ıi]nacak|deadline))/i.test(window)) return "FULL_APPLICATION_DEADLINE";
  if (/(ön\s+ba[şs]vuru|pre[-\s]?application)/i.test(window)) return "PRE_APPLICATION_DEADLINE";
  if (/(a[çc][ıi]l[ıi][şs]|opening|başvurular.*başla)/i.test(window)) return "OPENING_DATE";
  if (/(yay[ıi]n|published|duyuru\s+tarihi)/i.test(window)) return "PUBLICATION_DATE";
  if (/(sonu[çc]|result)/i.test(window)) return "RESULT_DATE";
  if (/(toplant[ıi]|info\s+day|bilgilendirme)/i.test(window)) return "INFO_SESSION_DATE";
  return "DATE";
}

function dedupeDates(dates) {
  const seen = new Set();
  return dates.filter((date) => {
    const key = `${date.type}:${date.date}:${date.time || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function computeStatus(call, now = new Date()) {
  const text = `${call.title || ""} ${call.summary || ""} ${call.description || ""}`.toLocaleLowerCase("tr-TR");
  if (/(iptal\s+edil|cancelled|canceled)/i.test(text)) return NORMALIZED_STATUSES.CANCELLED;
  if (/(ask[ıi]ya\s+al[ıi]n|paused|suspended)/i.test(text)) return NORMALIZED_STATUSES.PAUSED;
  if (/(sonu[çc](?:lar[ıi])?\s+a[çc][ıi]kland[ıi]|result\s+published)/i.test(text)) return NORMALIZED_STATUSES.RESULT_PUBLISHED;
  if (/(s[üu]re(?:si)?\s+uzat[ıi](?:ld[ıi]|lm[ıi][şs]t[ıi]r)|uzat[ıi](?:ld[ıi]|lm[ıi][şs]t[ıi]r)|ba[şs]vuru\s+takvimi\s+g[üu]ncell|ileri\s+bir\s+tarihe\s+al[ıi]n|deadline\s+extended)/i.test(text)) return NORMALIZED_STATUSES.EXTENDED;

  const opening = call.openingDate ? new Date(call.openingDate) : null;
  const deadline = call.deadline ? new Date(call.deadline) : null;
  const nowMs = now.getTime();
  if (opening && opening.getTime() > nowMs) return NORMALIZED_STATUSES.UPCOMING;
  if (deadline) {
    const end = new Date(deadline);
    end.setHours(23, 59, 59, 999);
    const remainingDays = Math.ceil((end.getTime() - nowMs) / 86400000);
    if (remainingDays < 0) return NORMALIZED_STATUSES.CLOSED;
    if (remainingDays <= 7) return NORMALIZED_STATUSES.CLOSING_SOON;
    return NORMALIZED_STATUSES.OPEN;
  }
  if (/(ba[şs]vuruya\s+a[çc][ıi](?:k|ld[ıi])|open\s+call|call\s+for)/i.test(text)) return NORMALIZED_STATUSES.OPEN;
  return NORMALIZED_STATUSES.UNKNOWN;
}

export function legacyStatus(status) {
  if ([NORMALIZED_STATUSES.OPEN, NORMALIZED_STATUSES.CLOSING_SOON, NORMALIZED_STATUSES.EXTENDED].includes(status)) return "open";
  if (status === NORMALIZED_STATUSES.UPCOMING || status === NORMALIZED_STATUSES.ANNOUNCED) return "upcoming";
  if (status === NORMALIZED_STATUSES.CLOSED || status === NORMALIZED_STATUSES.ARCHIVED || status === NORMALIZED_STATUSES.CANCELLED) return "closed";
  return "upcoming";
}

export function scoreConfidence(call, source, institutionMatch = call.institutionMatch) {
  let qualityScore = 0;
  const official = source?.sourceType === "official";
  if (official) qualityScore += 18;
  if (call.officialUrl || call.url) qualityScore += 10;
  if (call.applicationUrl) qualityScore += 8;
  if (call.deadline) qualityScore += 15;
  if (call.institution || call.funder) qualityScore += 10;
  if (call.callCode || call.externalId) qualityScore += 10;
  if (call.guideUrl || call.attachments?.some((item) => /\.pdf/i.test(item.url || item))) qualityScore += 5;
  if (call.pageType === PAGE_TYPES.CALL_DETAIL) qualityScore += 5;
  if (call.title && call.summary && (call.support || call.supportType)) qualityScore += 9;
  if (!official) qualityScore -= 6;
  if (!call.deadline) qualityScore -= 18;
  if (!call.funder && !call.institution) qualityScore -= 12;
  if (call.linkHealth?.status && call.linkHealth.status !== LINK_STATUSES.WORKING && call.linkHealth.status !== LINK_STATUSES.REDIRECTED) qualityScore -= 15;
  const sourceMatchScore = institutionMatch?.score ?? 0;
  return Math.max(0, Math.min(100, Math.round(sourceMatchScore * 0.7 + Math.max(0, qualityScore) * 0.3)));
}

const MONEY_PATTERN = /(?:(€|EUR|₺|TL|TRY|\$|USD)\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s*(bin|thousand|milyon|million|milyar|billion))?\s*(€|EUR|₺|TL|TRY|\$|USD)?/gi;

function currencyFromToken(token = "") {
  const value = token.toLocaleUpperCase("tr-TR");
  if (["₺", "TL", "TRY"].includes(value)) return "TRY";
  if (["€", "EUR"].includes(value)) return "EUR";
  if (["$", "USD"].includes(value)) return "USD";
  return "";
}

function currencyDisplay(currency = "") {
  return { TRY: "TL", EUR: "EUR", USD: "USD" }[currency] || currency;
}

function parseLocalizedNumber(value = "") {
  const text = String(value).trim();
  if (!text) return null;
  const commaCount = (text.match(/,/g) || []).length;
  const dotCount = (text.match(/\./g) || []).length;
  if (dotCount > 1 && commaCount === 0) {
    const number = Number(text.replace(/\./g, ""));
    return Number.isFinite(number) ? number : null;
  }
  if (commaCount > 1 && dotCount === 0) {
    const number = Number(text.replace(/,/g, ""));
    return Number.isFinite(number) ? number : null;
  }
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized = text;
  if (lastComma > lastDot) normalized = text.replace(/\./g, "").replace(",", ".");
  else normalized = text.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function amountMultiplier(unit = "") {
  const value = unit.toLocaleLowerCase("tr-TR");
  if (["bin", "thousand"].includes(value)) return 1_000;
  if (["milyon", "million"].includes(value)) return 1_000_000;
  if (["milyar", "billion"].includes(value)) return 1_000_000_000;
  return 1;
}

function isFundingContext(text = "", index = 0) {
  const window = text.slice(Math.max(0, index - 90), index + 120).toLocaleLowerCase("tr-TR");
  return /(destek|hibe|b[üu]t[çc]e|fon|fund|grant|budget|finansman|katk[ıi]|azami|maksimum|max|üst\s+limit|limit)/i.test(window);
}

export function extractFundingDetails(text = "") {
  const clean = normalizeText(text);
  const amounts = [];
  for (const match of clean.matchAll(MONEY_PATTERN)) {
    const currency = currencyFromToken(match[1] || match[4] || "");
    if (!currency || !isFundingContext(clean, match.index || 0)) continue;
    const base = parseLocalizedNumber(match[2]);
    if (!base) continue;
    amounts.push({
      value: Math.round(base * amountMultiplier(match[3] || "")),
      currency,
      rawText: normalizeText(clean.slice(Math.max(0, (match.index || 0) - 70), Math.min(clean.length, (match.index || 0) + match[0].length + 90))),
      index: match.index || 0,
    });
  }

  const rateMatch =
    clean.match(/(?:destek|hibe|fonlama|funding|grant|co[-\s]?funding)[^.%\n]{0,80}?(?:%|y[üu]zde\s*)(\d{1,3})(?:[.,](\d{1,2}))?/i) ||
    clean.match(/(?:%|y[üu]zde\s*)(\d{1,3})(?:[.,](\d{1,2}))?[^.\n]{0,80}?(?:destek|hibe|fonlama|funding|grant|co[-\s]?funding)/i);
  const supportRate = rateMatch ? Number(`${rateMatch[1]}.${rateMatch[2] || 0}`) : null;
  const saneRate = supportRate && supportRate > 0 && supportRate <= 100 ? supportRate : null;
  const byCurrency = amounts.length ? amounts.filter((item) => item.currency === amounts[0].currency) : [];
  const values = byCurrency.map((item) => item.value).sort((a, b) => a - b);
  const budgetMin = values.length > 1 ? values[0] : null;
  const budgetMax = values.at(-1) || null;
  const currency = byCurrency[0]?.currency || "";
  const support = budgetMax
    ? `${budgetMax.toLocaleString("tr-TR")} ${currencyDisplay(currency)}${budgetMin ? ` üst limit, alt limit ${budgetMin.toLocaleString("tr-TR")} ${currencyDisplay(currency)}` : ""}`
    : "";
  return {
    budgetMin,
    budgetMax,
    currency,
    supportRate: saneRate,
    support,
    evidence: {
      ...(budgetMax ? { budget: { value: budgetMax, rawText: byCurrency.at(-1)?.rawText || "", confidence: 0.82 } } : {}),
      ...(saneRate ? { supportRate: { value: saneRate, rawText: rateMatch?.[0] || "", confidence: 0.78 } } : {}),
    },
  };
}

function isGenericSupportText(value = "") {
  return !value || /belirtilir|dok[üu]man|detay|de[ğg]i[şs]ir|ko[şs]ullar[ıi]na\s+g[öo]re|aktif\s+[çc]a[ğg]r[ıi]/i.test(value);
}

export function normalizeCallRecord(call, { source = null, previousCall = null, detectedAt = new Date().toISOString() } = {}) {
  const resolvedSource = source || findSourceForCall(call);
  const sourceId = call.sourceId || resolvedSource?.id || "unknown";
  const title = normalizeText(call.title);
  const rawText = normalizeText(`${title} ${call.summary || ""} ${call.description || ""} ${call.support || ""}`);
  const fundingDetails = extractFundingDetails(rawText);
  const dates = parseImportantDates(rawText, { timezone: resolvedSource?.timezone || "Europe/Istanbul" });
  const deadlineEvidence =
    (call.deadline && {
      value: call.deadline,
      rawText: dates.find((item) => item.type.includes("DEADLINE"))?.rawText || call.summary || title,
      sourceUrl: call.url,
      confidence: call.deadline ? 0.95 : 0,
    }) ||
    null;
  const pageType = classifyPageType({ title, text: rawText, url: call.url });
  const fundingMatch = matchFundingSource({ ...call, title, sourceId }, { source: resolvedSource });
  const resolvedFundingSource = fundingMatch.fundingSource || fundingSourceById(sourceId);
  const { officialUrl, applicationUrl, pageIsOfficial } = determineOfficialLinks(call, resolvedFundingSource, resolvedSource);
  const precomputed = {
    ...call,
    title,
    funder: call.funder || resolvedFundingSource?.name_tr || resolvedFundingSource?.name || resolvedSource?.name || "",
    institution: call.institution || resolvedFundingSource?.name_tr || resolvedFundingSource?.name || resolvedSource?.name || "",
    programme: call.programme || call.category || resolvedFundingSource?.programs?.[0] || "",
    officialUrl,
    applicationUrl,
  };
  const normalizedStatus = computeStatus({ ...precomputed, importantDates: dates });
  const structuredHash = buildStructuredContentHash(precomputed);
  const matchedPrevious = previousCall || findPreviousCallRecord({ ...(previousCall ? { [previousCall.id || "previous"]: previousCall } : {}) }, { ...precomputed, contentHash: structuredHash }) || null;
  const deadlineHistory = [...new Set([...(call.deadlineHistory || []), ...(matchedPrevious?.deadlineHistory || []), ...(matchedPrevious?.deadline && matchedPrevious.deadline !== call.deadline ? [matchedPrevious.deadline] : [])].filter(Boolean))];
  const autoThreshold = Number(process.env.CONFIDENCE_AUTO_PUBLISH_MIN || AUTOMATION_CONFIG.institutionDetectionThresholds.automaticApproval);
  const reviewThreshold = Number(process.env.CONFIDENCE_MANUAL_REVIEW_MIN || AUTOMATION_CONFIG.institutionDetectionThresholds.manualReview);
  const verifiableSource = pageIsOfficial || fundingMatch.verifiedOfficialLink || Boolean(officialUrl) || Boolean(applicationUrl);
  const hasInstitutionEvidence = Boolean(resolvedFundingSource && (fundingMatch.domainMatched || fundingMatch.aliasHits || fundingMatch.programHits || fundingMatch.keywordHits));
  const enhanced = {
    ...call,
    id: call.id || `${sourceId}-${slugify(title)}`,
    sourceId,
    externalId: call.externalId || "",
    callCode: call.callCode || call.externalId || title.match(/\b[A-Z0-9]{2,}(?:-[A-Z0-9]+){1,}\b/)?.[0] || "",
    slug: call.slug || slugify(title),
    title,
    originalTitle: call.originalTitle || title,
    institution: precomputed.institution,
    programme: precomputed.programme,
    fundingSourceId: resolvedFundingSource?.id || "",
    fundingSourceName: resolvedFundingSource?.name || "",
    fundingSourceNameTr: resolvedFundingSource?.name_tr || "",
    sourceRegion: resolvedFundingSource?.region || "",
    country: call.country || resolvedFundingSource?.country || resolvedSource?.country || "",
    language: call.language || resolvedSource?.language || "",
    categories: call.categories || [call.category].filter(Boolean),
    normalizedStatus,
    status: legacyStatus(normalizedStatus),
    publicationDate: call.publicationDate || call.publishedAt || null,
    openingDate: call.openingDate || null,
    deadline: call.deadline || null,
    deadlineTime: call.deadlineTime || deadlineEvidence?.value?.match(/T(\d{2}:\d{2})/)?.[1] || null,
    deadlineTimezone: call.deadlineTimezone || resolvedSource?.timezone || "",
    targetAudience: call.targetAudience || [],
    eligibleCountries: call.eligibleCountries || [],
    eligibleInstitutions: call.eligibleInstitutions || [],
    supportType: call.supportType || call.category || "",
    support: !isGenericSupportText(call.support) ? call.support : fundingDetails.support || call.support || "",
    budgetMin: call.budgetMin ?? fundingDetails.budgetMin,
    budgetMax: call.budgetMax ?? fundingDetails.budgetMax,
    currency: call.currency || fundingDetails.currency || "",
    supportRate: call.supportRate ?? fundingDetails.supportRate,
    projectDuration: call.projectDuration || "",
    description: call.description || "",
    objectives: call.objectives || [],
    eligibility: call.eligibility || [],
    requiredDocuments: call.requiredDocuments || [],
    applicationSteps: call.applicationSteps || [],
    importantDates: call.importantDates || dates,
    sourceUrl: call.sourceUrl || call.url || "",
    officialUrl,
    applicationUrl,
    guideUrl: call.guideUrl || "",
    attachments: call.attachments || [],
    contacts: call.contacts || [],
    sourcePublishedAt: call.sourcePublishedAt || call.publishedAt || null,
    firstDetectedAt: call.firstDetectedAt || detectedAt,
    lastDetectedAt: detectedAt,
    lastVerifiedAt: detectedAt,
    contentHash: call.contentHash || structuredHash,
    deadlineHistory,
    previousDeadline: deadlineHistory.at(-1) || null,
    pageType: call.pageType || pageType.pageType,
    pageTypeConfidence: call.pageTypeConfidence || pageType.confidence,
    institutionMatch: {
      fundingSourceId: resolvedFundingSource?.id || "",
      fundingSourceName: resolvedFundingSource?.name || "",
      score: fundingMatch.score,
      domainMatched: fundingMatch.domainMatched,
      aliasHits: fundingMatch.aliasHits,
      programHits: fundingMatch.programHits,
      keywordHits: fundingMatch.keywordHits,
      verifiedOfficialLink: fundingMatch.verifiedOfficialLink,
      pageIsOfficial,
    },
    evidence: {
      ...(call.evidence || {}),
      ...(deadlineEvidence ? { deadline: deadlineEvidence } : {}),
      status: { value: normalizedStatus, rawText: rawText.slice(0, 280), sourceUrl: call.url, confidence: pageType.confidence },
      officialUrl: { value: officialUrl || "", rawText: officialUrl || "", sourceUrl: call.url, confidence: officialUrl ? 0.95 : 0 },
      applicationUrl: { value: applicationUrl || "", rawText: applicationUrl || "", sourceUrl: call.url, confidence: applicationUrl ? 0.92 : 0 },
      ...fundingDetails.evidence,
    },
  };
  enhanced.confidenceScore = call.confidenceScore ?? scoreConfidence(enhanced, resolvedSource, enhanced.institutionMatch);
  enhanced.reviewStatus = !resolvedFundingSource || (enhanced.confidenceScore < reviewThreshold && !hasInstitutionEvidence)
    ? "rejected"
    : enhanced.confidenceScore < autoThreshold || !verifiableSource || resolvedSource?.sourceType === "secondary" && !fundingMatch.verifiedOfficialLink
      ? "manual_review"
      : "approved";
  enhanced.requiresManualReview = enhanced.reviewStatus === "manual_review" || Boolean(call.requiresManualReview);
  enhanced.isPublished =
    call.isPublished ??
    (enhanced.reviewStatus === "approved" &&
      verifiableSource &&
      ![PAGE_TYPES.RESULT_ANNOUNCEMENT, PAGE_TYPES.IRRELEVANT, PAGE_TYPES.CANCELLATION].includes(enhanced.pageType));
  enhanced.isAccepted = enhanced.reviewStatus !== "rejected";
  return enhanced;
}

export function detectDuplicateKey(call) {
  if (call.contentHash) return `hash:${call.contentHash}`;
  if (call.callCode) return `code:${call.sourceId}:${call.callCode}`;
  if (call.externalId) return `external:${call.sourceId}:${call.externalId}`;
  if (call.officialUrl) return `url:${call.officialUrl}`;
  return `title:${call.sourceId}:${slugify(call.title)}:${call.deadline || ""}`;
}

export function dedupeAndFlag(calls) {
  const seen = new Map();
  const duplicates = [];
  const result = [];
  for (const call of calls) {
    const key = detectDuplicateKey(call);
    const previous = seen.get(key);
    if (previous) {
      duplicates.push({ primaryCallId: previous.id, duplicateCallId: call.id, key, detectedAt: new Date().toISOString() });
      previous.alternativeSources = [...(previous.alternativeSources || []), { sourceId: call.sourceId, url: call.officialUrl || call.url }];
      if ((call.confidenceScore || 0) > (previous.confidenceScore || 0)) Object.assign(previous, { ...previous, ...call, alternativeSources: previous.alternativeSources });
      previous.deadlineHistory = [...new Set([...(previous.deadlineHistory || []), ...(call.deadlineHistory || [])].filter(Boolean))];
      continue;
    }
    seen.set(key, call);
    result.push(call);
  }
  return { calls: result, duplicates };
}

export function detectChanges(previousCalls = {}, nextCalls = []) {
  const changes = [];
  const criticalFields = ["deadline", "normalizedStatus", "budgetMax", "supportRate", "applicationUrl", "guideUrl", "contentHash"];
  for (const call of nextCalls) {
    const previous = previousCalls[call.id];
    if (!previous) {
      changes.push({ callId: call.id, field: "created", oldValue: null, newValue: call.id, detectedAt: new Date().toISOString(), sourceUrl: call.officialUrl || call.url, evidenceText: call.title });
      continue;
    }
    for (const field of criticalFields) {
      if ((previous[field] || null) !== (call[field] || null)) {
        changes.push({
          callId: call.id,
          field,
          oldValue: previous[field] || null,
          newValue: call[field] || null,
          detectedAt: new Date().toISOString(),
          sourceUrl: call.officialUrl || call.url,
          evidenceText: call.evidence?.[field]?.rawText || call.summary || call.title,
        });
      }
    }
  }
  return changes;
}

export class AutomationQueue {
  constructor({ concurrency = 2, baseDelayMs = Number(process.env.CRAWLER_RETRY_BASE_DELAY_MS || 1000), maxDelayMs = Number(process.env.CRAWLER_RETRY_MAX_DELAY_MS || 15 * 60 * 1000) } = {}) {
    this.concurrency = concurrency;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.pending = [];
    this.running = new Map();
    this.deadLetters = [];
    this.processed = [];
    this.activeKeys = new Set();
  }

  enqueue(job) {
    const normalized = {
      id: job.id || `${job.type}-${contentHash(`${job.type}:${job.url || job.sourceId || ""}:${Date.now()}`).slice(0, 12)}`,
      type: job.type,
      sourceId: job.sourceId || "",
      url: job.url || "",
      payload: job.payload || {},
      priority: job.priority ?? 5,
      retryCount: job.retryCount || 0,
      maxRetries: job.maxRetries ?? Number(process.env.CRAWLER_JOB_MAX_RETRIES || 3),
      timeoutMs: job.timeoutMs ?? Number(process.env.CRAWLER_JOB_TIMEOUT_MS || 15000),
      idempotencyKey: job.idempotencyKey || `${job.type}:${job.url || job.sourceId || ""}`,
      status: job.status || "pending",
      errorCode: job.errorCode || "",
      errorMessage: job.errorMessage || "",
      availableAt: job.availableAt || new Date().toISOString(),
      createdAt: job.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (this.activeKeys.has(normalized.idempotencyKey)) return normalized;
    this.activeKeys.add(normalized.idempotencyKey);
    this.pending.push(normalized);
    this.pending.sort((a, b) => a.priority - b.priority);
    return normalized;
  }

  restore(snapshot = {}) {
    const source = Array.isArray(snapshot)
      ? { processed: snapshot }
      : snapshot || {};
    const pending = [
      ...(source.pendingJobs || []),
      ...(source.runningJobs || []).map((job) => ({ ...job, status: "pending", availableAt: new Date().toISOString() })),
    ];
    const deadLetters = source.deadLetters || [];
    const processed = source.processed || (Array.isArray(snapshot) ? snapshot : []);
    this.pending = [];
    this.running = new Map();
    this.deadLetters = [];
    this.processed = [];
    this.activeKeys = new Set();
    for (const job of pending) this.enqueue({ ...job, status: "pending" });
    for (const job of deadLetters.slice(-50)) {
      const deadLetter = { ...job, status: "dead_letter" };
      this.deadLetters.push(deadLetter);
      this.processed.push(deadLetter);
    }
    for (const job of processed.slice(-100)) {
      if (job?.status !== "dead_letter") this.processed.push(job);
    }
    return this.snapshot();
  }

  nextBackoffMs(job) {
    const retry = Math.max(0, job.retryCount || 0);
    const jitter = Math.floor(Math.random() * this.baseDelayMs);
    return Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** retry + jitter);
  }

  fail(job, error = {}) {
    const failed = {
      ...job,
      retryCount: (job.retryCount || 0) + 1,
      errorCode: error.code || error.name || "JOB_ERROR",
      errorMessage: error.message || String(error),
      updatedAt: new Date().toISOString(),
    };
    this.running.delete(job.id);
    if (failed.retryCount > failed.maxRetries) {
      const deadLetter = { ...failed, status: "dead_letter", failedAt: new Date().toISOString() };
      this.deadLetters.push(deadLetter);
      this.processed.push(deadLetter);
      this.activeKeys.delete(failed.idempotencyKey);
      return deadLetter;
    }
    const delayMs = this.nextBackoffMs(failed);
    const retried = {
      ...failed,
      status: "pending",
      availableAt: new Date(Date.now() + delayMs).toISOString(),
      backoffMs: delayMs,
    };
    this.pending.push(retried);
    this.pending.sort((a, b) => a.priority - b.priority || new Date(a.availableAt).getTime() - new Date(b.availableAt).getTime());
    return retried;
  }

  complete(job, result = {}) {
    const completed = {
      ...job,
      status: "completed",
      result,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.running.delete(job.id);
    this.processed.push(completed);
    this.activeKeys.delete(job.idempotencyKey);
    return completed;
  }

  completeByIdempotencyKey(idempotencyKey, result = {}) {
    const pendingIndex = this.pending.findIndex((job) => job.idempotencyKey === idempotencyKey);
    if (pendingIndex !== -1) {
      const [job] = this.pending.splice(pendingIndex, 1);
      return this.complete({ ...job, status: "running", startedAt: new Date().toISOString() }, result);
    }
    const running = [...this.running.values()].find((job) => job.idempotencyKey === idempotencyKey);
    if (running) return this.complete(running, result);
    return null;
  }

  takeReady() {
    if (this.running.size >= this.concurrency) return null;
    const now = Date.now();
    const index = this.pending.findIndex((job) => new Date(job.availableAt).getTime() <= now);
    if (index === -1) return null;
    const [job] = this.pending.splice(index, 1);
    const running = { ...job, status: "running", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.running.set(running.id, running);
    return running;
  }

  snapshot() {
    return {
      pending: this.pending.length,
      pendingJobs: this.pending.slice(0, 50),
      running: this.running.size,
      runningJobs: [...this.running.values()],
      deadLetters: this.deadLetters.slice(-20),
      processed: this.processed.slice(-50),
      jobTypes: Object.values(JOB_TYPES),
    };
  }

  persistableSnapshot() {
    const snapshot = this.snapshot();
    return {
      ...snapshot,
      pendingJobs: snapshot.pendingJobs,
      runningJobs: snapshot.runningJobs,
      deadLetters: snapshot.deadLetters,
      processed: snapshot.processed,
      savedAt: new Date().toISOString(),
    };
  }
}

export function createSourceAdapters(scraperMap = {}) {
  return SOURCE_REGISTRY.filter((source) => source.isActive).map((source) => ({
    ...source,
    discover: async () => scraperMap[source.id]?.discover?.() || source.listUrls,
    discoverListPages: async () => scraperMap[source.id]?.discover?.() || source.listUrls,
    fetchListPage: async (url = source.listUrls[0]) => {
      const scraper = scraperMap[source.id];
      if (scraper?.fetchListPage) return scraper.fetchListPage(url);
      return { sourceId: source.id, urls: source.listUrls };
    },
    extractListItems: async (page) => {
      const scraper = scraperMap[source.id];
      if (scraper?.extractListItems) return scraper.extractListItems(page);
      if (typeof scraper === "function") return scraper();
      return [];
    },
    extractDetailUrls: async () => [],
    fetchDetailPage: async (item) => scraperMap[source.id]?.fetchDetailPage?.(item) || null,
    extractDetailData: async (page, item) => scraperMap[source.id]?.extractDetailData?.(page, item) || {},
    discoverDocuments: async (detailData) => detailData?.attachments || [],
    parseDocuments: async () => [],
    validate: async (items) => items.filter(Boolean),
    normalize: async (items, previousCalls = {}) => items.map((item) => {
      const firstPass = normalizeCallRecord(item, { source });
      return normalizeCallRecord(firstPass, { source, previousCall: findPreviousCallRecord(previousCalls, firstPass) });
    }),
    healthCheck: async () => scraperMap[source.id]?.healthCheck?.() || { ok: true },
    extractStructuredData: async () => {
      const scraper = scraperMap[source.id];
      if (!scraper) return [];
      if (typeof scraper === "function") return scraper();
      const urls = await (scraper.discover?.() || source.listUrls);
      const items = [];
      for (const url of urls) {
        const page = await scraper.fetchListPage(url);
        const listItems = await scraper.extractListItems(page);
        if (process.env.ENABLE_DEEP_SCRAPING !== "false" && scraper.fetchDetailPage && scraper.extractDetailData) {
          for (const item of listItems) {
            try {
              const detailPage = await scraper.fetchDetailPage(item);
              const detail = await scraper.extractDetailData(detailPage, item);
              items.push({ ...item, ...detail });
            } catch {
              items.push(item);
            }
          }
        } else {
          items.push(...listItems);
        }
      }
      return items;
    },
    validateExtractedData: async (items) => items.filter(Boolean),
    normalizeData: async (items, previousCalls = {}) => items.map((item) => {
      const firstPass = normalizeCallRecord(item, { source });
      return normalizeCallRecord(firstPass, { source, previousCall: findPreviousCallRecord(previousCalls, firstPass) });
    }),
    detectChanges: async (items, previous) => detectChanges(previous, items),
  }));
}

export async function loadAutomationState(statePath) {
  try {
    const dbState = loadStateFromDb();
    if (!dbState || !dbState.version) {
      // Fallback to initial if db empty
      throw new Error("Empty DB");
    }
    return dbState;
  } catch {
    // Try to load from legacy JSON file if DB fails/is empty
    try {
      const raw = await fs.readFile(statePath, "utf8");
      const legacyState = { version: STATE_VERSION, ...JSON.parse(raw) };
      // Migrate to DB automatically
      saveStateToDb(legacyState);
      return legacyState;
    } catch {
      return {
        version: STATE_VERSION,
        calls: {},
        sources: Object.fromEntries(SOURCE_REGISTRY.map((source) => [source.id, { ...source, consecutiveFailures: 0, healthStatus: "healthy" }])),
        sourceCrawlLogs: [],
        callChangeLogs: [],
        manualReviewQueue: [],
        crawlerJobs: [],
        linkHealthChecks: [],
        metrics: {},
      };
    }
  }
}

export async function saveAutomationState(statePath, state) {
  saveStateToDb(state);
}

export function updateSourceHealth(state, source, { ok, durationMs = 0, status = null, error = null, found = 0 } = {}) {
  const current = state.sources[source.id] || { ...source, consecutiveFailures: 0 };
  const now = new Date().toISOString();
  const consecutiveFailures = ok ? 0 : (current.consecutiveFailures || 0) + 1;
  const healthStatus = ok ? "healthy" : consecutiveFailures >= 3 ? "failed" : "degraded";
  state.sources[source.id] = {
    ...current,
    lastSuccessfulCrawlAt: ok ? now : current.lastSuccessfulCrawlAt || null,
    lastFailedCrawlAt: ok ? current.lastFailedCrawlAt || null : now,
    consecutiveFailures,
    healthStatus,
    averageResponseTimeMs: current.averageResponseTimeMs ? Math.round((current.averageResponseTimeMs + durationMs) / 2) : durationMs,
    lastHttpStatus: status,
  };
  state.sourceCrawlLogs.push({
    sourceId: source.id,
    adapter: source.adapterName,
    operation: "crawl",
    durationMs,
    status: ok ? "success" : "failed",
    errorCode: error?.name || error?.code || "",
    errorMessage: error?.message || "",
    found,
    timestamp: now,
  });
  state.sourceCrawlLogs = state.sourceCrawlLogs.slice(-500);
}

export function buildManualReviewItems(calls, duplicates = [], linkHealthChecks = []) {
  const items = [];
  const now = new Date().toISOString();
  for (const call of calls) {
    const reasons = [];
    if (call.reviewStatus === "rejected" || (call.confidenceScore || 0) < AUTOMATION_CONFIG.institutionDetectionThresholds.rejectBelow) continue;
    if ((call.confidenceScore || 0) < Number(process.env.CONFIDENCE_AUTO_PUBLISH_MIN || AUTOMATION_CONFIG.institutionDetectionThresholds.automaticApproval)) reasons.push("LOW_CONFIDENCE");
    if (!call.deadline) reasons.push("MISSING_DEADLINE");
    if (!call.officialUrl) reasons.push("MISSING_OFFICIAL_URL");
    if (!call.fundingSourceId) reasons.push("UNMATCHED_FUNDING_SOURCE");
    if (!call.isPublished) reasons.push("NEEDS_VERIFICATION");
    if (call.pageType === PAGE_TYPES.CANCELLATION || call.normalizedStatus === NORMALIZED_STATUSES.CANCELLED) reasons.push("CANCELLATION_SIGNAL");
    if (call.normalizedStatus === NORMALIZED_STATUSES.EXTENDED) reasons.push("DEADLINE_EXTENSION_SIGNAL");
    if (reasons.length) items.push({ id: `review-${call.id}`, callId: call.id, title: call.title, reasons, status: "pending", createdAt: now });
  }
  for (const duplicate of duplicates) {
    items.push({ id: `review-duplicate-${duplicate.duplicateCallId}`, callId: duplicate.duplicateCallId, title: "Muhtemel duplicate kayıt", reasons: ["POSSIBLE_DUPLICATE"], status: "pending", createdAt: now, duplicate });
  }
  for (const link of linkHealthChecks.filter((item) => ![LINK_STATUSES.WORKING, LINK_STATUSES.REDIRECTED].includes(item.status))) {
    items.push({ id: `review-link-${contentHash(link.url).slice(0, 12)}`, callId: link.callId, title: "Link doğrulama uyarısı", reasons: ["BROKEN_LINK"], status: "pending", createdAt: now, link });
  }
  return items;
}

export function buildLinkCheckCandidates(calls, { limit = Number(process.env.LINK_VERIFY_LIMIT || 25) } = {}) {
  return calls
    .flatMap((call) => [
      { callId: call.id, type: "official", url: call.officialUrl || call.url },
      { callId: call.id, type: "application", url: call.applicationUrl },
      { callId: call.id, type: "guide", url: call.guideUrl },
      ...(call.attachments || []).map((attachment) => ({ callId: call.id, type: "attachment", url: attachment.url || attachment })),
    ])
    .filter((item) => item.url && isSafeCrawlerUrl(item.url))
    .filter((item, index, list) => index === list.findIndex((candidate) => candidate.callId === item.callId && candidate.type === item.type && candidate.url === item.url))
    .slice(0, limit);
}

export async function verifyLinks(calls, { timeoutMs = 5000, candidates = null } = {}) {
  const checks = [];
  const linkCandidates = candidates || buildLinkCheckCandidates(calls);
  for (const candidate of linkCandidates) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response = await fetch(candidate.url, { method: "HEAD", redirect: "follow", signal: controller.signal });
      if ([405, 501].includes(response.status)) {
        response = await fetch(candidate.url, { method: "GET", redirect: "follow", signal: controller.signal });
      }
      clearTimeout(timer);
      const redirected = response.url && response.url !== candidate.url;
      checks.push({
        ...candidate,
        status: redirected ? LINK_STATUSES.REDIRECTED : response.ok ? LINK_STATUSES.WORKING : response.status === 403 ? LINK_STATUSES.FORBIDDEN : LINK_STATUSES.BROKEN,
        httpStatus: response.status,
        finalUrl: response.url,
        durationMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      clearTimeout(timer);
      checks.push({ ...candidate, status: error.name === "AbortError" ? LINK_STATUSES.TIMEOUT : LINK_STATUSES.UNKNOWN, durationMs: Date.now() - started, error: error.message, checkedAt: new Date().toISOString() });
    }
  }
  return checks;
}

export function buildAutomationMetrics(state, calls) {
  const last24 = Date.now() - 86400000;
  const crawlLogs24 = state.sourceCrawlLogs.filter((log) => new Date(log.timestamp).getTime() >= last24);
  const changeLogs24 = state.callChangeLogs.filter((log) => new Date(log.detectedAt).getTime() >= last24);
  const activeSources = Object.values(state.sources).filter((source) => source.isActive !== false);
  const failedSources = activeSources.filter((source) => source.healthStatus === "failed");
  const confidenceScores = calls.map((call) => call.confidenceScore || 0);
  return {
    activeSources: activeSources.length,
    crawledUrlsLast24h: crawlLogs24.length,
    newCallsLast24h: changeLogs24.filter((log) => log.field === "created").length,
    updatedCallsLast24h: changeLogs24.filter((log) => log.field !== "created").length,
    closedCalls: calls.filter((call) => call.normalizedStatus === NORMALIZED_STATUSES.CLOSED).length,
    extendedCalls: calls.filter((call) => call.normalizedStatus === NORMALIZED_STATUSES.EXTENDED).length,
    duplicateRecords: state.duplicates?.length || 0,
    manualReviewPending: state.manualReviewQueue.filter((item) => item.status === "pending").length,
    failedSources: failedSources.length,
    averageCrawlDurationMs: crawlLogs24.length ? Math.round(crawlLogs24.reduce((sum, log) => sum + (log.durationMs || 0), 0) / crawlLogs24.length) : 0,
    averageConfidenceScore: confidenceScores.length ? Math.round(confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length) : 0,
  };
}

export function mergeManualReviewQueue(existing = [], incoming = []) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  const incomingIds = new Set(incoming.map((item) => item.id));
  for (const [id, item] of byId) {
    if (item.status === "pending" && !incomingIds.has(id)) byId.delete(id);
  }
  for (const item of incoming) {
    const previous = byId.get(item.id);
    byId.set(item.id, previous ? { ...item, ...previous, reasons: item.reasons, title: item.title } : item);
  }
  return [...byId.values()].slice(-500);
}
