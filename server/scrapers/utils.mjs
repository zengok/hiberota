import * as cheerio from "cheerio";

export const USER_AGENT =
  process.env.SOURCE_USER_AGENT || "ProjeYakalama/1.0 (+project-call-monitor; contact: admin@example.com)";

export const SOURCE_TIMEOUT_MS = Number(process.env.SOURCE_TIMEOUT_MS || 12000);

export function absoluteUrl(base, href) {
  try {
    return new URL(href || base, base).toString();
  } catch {
    return base;
  }
}

export function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeQualityText(value = "") {
  return normalizeWhitespace(value).toLocaleLowerCase("tr-TR");
}

export function slug(value) {
  return normalizeWhitespace(value)
    .toLowerCase("tr")
    .replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || `${item.title}-${item.deadline}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

export function loadHtml(html) {
  return cheerio.load(html);
}

export function parseDateLoose(value) {
  if (!value) return null;
  const clean = normalizeWhitespace(value);
  const months = {
    ocak: 0, subat: 1, şubat: 1, mart: 2, nisan: 3, mayis: 4, mayıs: 4, haziran: 5,
    temmuz: 6, agustos: 7, ağustos: 7, eylul: 8, eylül: 8, ekim: 9, kasim: 10,
    kasım: 10, aralik: 11, aralık: 11, jan: 0, january: 0, feb: 1, february: 1,
    mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9, nov: 10,
    november: 10, dec: 11, december: 11,
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

export function parseUsDate(value) {
  const match = normalizeWhitespace(value).match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (!match) return parseDateLoose(value);
  return new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]))).toISOString();
}

export function decodeEntities(value = "") {
  return loadHtml(`<span>${value}</span>`)("span").text();
}

export function extractMoney(text) {
  const match = normalizeWhitespace(text).match(
    /((?:€|EUR|₺|TL|\$|USD)\s?[\d.,]+(?:\s?(?:milyon|million|billion|milyar))?|[\d.,]+\s?(?:€|EUR|₺|TL|\$|USD)(?:\s?(?:milyon|million|billion|milyar))?)/i,
  );
  return match ? match[1] : "";
}

export function classifyScope(source, title = "") {
  const value = `${source} ${title}`.toLocaleLowerCase("tr-TR");
  if (value.includes("tübitak") || value.includes("tuseb") || value.includes("kosgeb")) return "Ulusal";
  if (value.includes("ufuk") || value.includes("horizon") || value.includes("eureka") || value.includes("euro")) return "Avrupa";
  return "Yurtdışı";
}

export function statusFromDeadline(deadline) {
  if (!deadline) return "upcoming";
  const lastMoment = new Date(deadline);
  lastMoment.setHours(23, 59, 59, 999);
  return lastMoment.getTime() >= Date.now() ? "open" : "closed";
}

export const NON_APPLICATION_PATTERNS = [
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

export function isNonApplicationAnnouncement(call) {
  const text = normalizeQualityText(`${call.title || ""} ${call.summary || ""} ${call.source || ""}`);
  return NON_APPLICATION_PATTERNS.some((pattern) => pattern.test(text));
}
