import {
  absoluteUrl,
  dedupe,
  extractMoney,
  getHtml,
  loadHtml,
  normalizeWhitespace,
  parseDateLoose,
  slug,
  statusFromDeadline,
} from "./utils.mjs";
import { GLOBAL_SOURCE_REGISTRY } from "../automation/global-source-catalog.mjs";

const FUNDING_KEYWORDS = [
  "grant",
  "grants",
  "funding",
  "fund",
  "funds",
  "call",
  "calls",
  "proposal",
  "proposals",
  "opportunity",
  "opportunities",
  "scholarship",
  "fellowship",
  "rfp",
  "programme",
  "program",
  "başvuru",
  "hibe",
  "destek",
];

const NEGATIVE_KEYWORDS = [
  "result",
  "results",
  "awardees",
  "winner",
  "winners",
  "press release",
  "news",
  "webinar",
  "event",
  "blog",
  "policy",
  "guidance only",
];

function keywordHit(text = "", keywords = []) {
  const haystack = text.toLocaleLowerCase("en-US");
  return keywords.some((keyword) => haystack.includes(keyword.toLocaleLowerCase("en-US")));
}

function extractDeadline(text = "") {
  const clean = normalizeWhitespace(text);
  const deadlinePattern =
    clean.match(/(?:deadline|closing date|closes|apply by|application deadline|submission deadline|son başvuru)[^.;,\n]{0,80}/i)?.[0] ||
    clean.match(/\b\d{1,2}[./-]\d{1,2}[./-]20\d{2}\b/)?.[0] ||
    clean.match(/\b\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+20\d{2}\b/i)?.[0] ||
    clean.match(/\b[A-Za-z]+\s+\d{1,2},?\s+20\d{2}\b/i)?.[0] ||
    "";
  return parseDateLoose(deadlinePattern);
}

function contextForLink($, link) {
  const node = $(link);
  const parentText = normalizeWhitespace(node.closest("article, li, tr, .card, .views-row, section, div").first().text());
  const title = normalizeWhitespace(node.text() || node.attr("title") || node.attr("aria-label") || "");
  return { title, context: parentText || title };
}

function inferCategory(text = "") {
  const value = text.toLocaleLowerCase("en-US");
  if (/scholarship|fellowship|doctoral|postdoc/.test(value)) return "Burs ve araştırmacı desteği";
  if (/health|medical|clinical|who/.test(value)) return "Sağlık ve yaşam bilimleri";
  if (/innovation|sme|startup|business|commerciali[sz]ation/.test(value)) return "İnovasyon ve girişimcilik";
  if (/climate|energy|environment|green|life programme/.test(value)) return "İklim, enerji ve çevre";
  if (/research|science|horizon|academic/.test(value)) return "Araştırma ve inovasyon";
  return "Uluslararası fon çağrısı";
}

function inferScope(source) {
  if (source.country === "TR") return "Ulusal";
  if (source.country === "EU" || source.config?.scope === "europe") return "Avrupa";
  return "Yurtdışı";
}

function normalizeCandidate({ source, pageUrl, href, title, context }) {
  const text = normalizeWhitespace(`${title} ${context}`);
  const deadline = extractDeadline(text);
  const url = absoluteUrl(pageUrl, href);
  return {
    id: `${source.id}-${slug(`${title || url}-${deadline || ""}`)}`,
    title: title || normalizeWhitespace(url.split("/").filter(Boolean).at(-1) || source.name),
    funder: source.name,
    source: source.name,
    sourceId: source.id,
    scope: inferScope(source),
    category: inferCategory(text),
    support: extractMoney(text) || "Kaynak detayında belirtilir",
    deadline,
    publishedAt: null,
    status: statusFromDeadline(deadline),
    url,
    officialUrl: url,
    applicationUrl: url,
    summary: text.slice(0, 360),
    confidence: deadline ? "yüksek" : "orta",
    country: source.country,
    language: source.language,
  };
}

export function createGlobalDiscoveryScraper(source) {
  return {
    id: source.id,
    async discover() {
      return source.listUrls;
    },
    async fetchListPage(url = source.listUrls[0]) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
      const customKeywords = source.config?.keywords || [];
      const allowedHosts = new Set([new URL(source.baseUrl).hostname]);
      const items = [];

      $("a[href]").each((_, link) => {
        const href = $(link).attr("href") || "";
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        const url = absoluteUrl(page.url, href);
        let host = "";
        try {
          host = new URL(url).hostname;
        } catch {
          return;
        }
        if (![...allowedHosts].some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return;
        const { title, context } = contextForLink($, link);
        const text = `${title} ${context} ${url}`;
        if (keywordHit(text, NEGATIVE_KEYWORDS)) return;
        if (!keywordHit(text, [...FUNDING_KEYWORDS, ...customKeywords])) return;
        if (normalizeWhitespace(title).length < 6 && !keywordHit(url, customKeywords)) return;
        items.push(normalizeCandidate({ source, pageUrl: page.url, href, title, context }));
      });

      return dedupe(items)
        .filter((item) => item.title && item.url)
        .slice(0, Number(process.env.GLOBAL_DISCOVERY_SOURCE_LIMIT || 50));
    },
    async fetchDetailPage(item) {
      if (!item?.url) return null;
      try {
        return { url: item.url, html: await getHtml(item.url) };
      } catch {
        return null;
      }
    },
    async extractDetailData(page, item) {
      if (!page?.html) return {};
      const $ = loadHtml(page.html);
      const mainText = normalizeWhitespace($("main").text() || $("body").text()).slice(0, 3000);
      const deadline = item.deadline || extractDeadline(mainText);
      const support = extractMoney(mainText) || item.support;
      return {
        description: mainText.slice(0, 1200),
        deadline,
        status: statusFromDeadline(deadline),
        support,
        summary: item.summary || mainText.slice(0, 360),
        guideUrl: $("a[href$='.pdf']").first().attr("href") ? absoluteUrl(page.url, $("a[href$='.pdf']").first().attr("href")) : "",
      };
    },
    async healthCheck() {
      return { ok: true, url: source.listUrls[0] };
    },
  };
}

export function createGlobalDiscoveryScrapers(sources = GLOBAL_SOURCE_REGISTRY) {
  return Object.fromEntries(sources.map((source) => [source.id, createGlobalDiscoveryScraper(source)]));
}
