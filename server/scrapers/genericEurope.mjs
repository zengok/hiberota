import { absoluteUrl, dedupe, getHtml, loadHtml, normalizeWhitespace, parseDateLoose, slug, statusFromDeadline } from "./utils.mjs";

export function createEuresearchScraper() {
  const sourceUrl = "https://www.euresearch.ch/en/our-services/inform/open-calls-137.html";
  return {
    id: "euresearch",
    async discover() {
      return [sourceUrl];
    },
    async fetchListPage(url = sourceUrl) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
      const items = [];
      $("table tr").each((_, row) => {
        const cells = $(row).find("td").map((__, cell) => normalizeWhitespace($(cell).text())).get();
        if (cells.length < 3) return;
        const [topic, openDateText, deadlineText] = cells;
        const deadline = parseDateLoose(deadlineText);
        if (!topic || !deadline || statusFromDeadline(deadline) !== "open") return;
        const code = topic.match(/^[A-Z0-9-]+/)?.[0] || "";
        const title = topic.replace(code, "").trim() || topic;
        const href = absoluteUrl(page.url, $(row).find("a[href]").first().attr("href"));
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
          url: href || page.url,
          summary: `${code || "Horizon Europe"} çağrısı. Açılış: ${openDateText}. Son başvuru: ${deadlineText}.`,
          confidence: "yüksek",
        });
      });
      return dedupe(items).slice(0, 120);
    },
    async fetchDetailPage() {
      return null;
    },
    async extractDetailData() {
      return {};
    },
    async healthCheck() {
      return { ok: true, url: sourceUrl };
    },
  };
}

export function createEuroAccessScraper() {
  const sourceUrl = "https://euro-access.eu/en-us/calls";
  return {
    id: "euroaccess",
    async discover() {
      return [sourceUrl];
    },
    async fetchListPage(url = sourceUrl) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
      const items = [];
      $("table tr").each((_, row) => {
        const cells = $(row).find("td").map((__, cell) => normalizeWhitespace($(cell).text())).get();
        if (cells.length < 3) return;
        const [programme, title, deadlineText] = cells;
        const deadline = parseDateLoose(deadlineText);
        if (!programme || !title || !deadline || statusFromDeadline(deadline) !== "open") return;
        const href = absoluteUrl(page.url, $(row).find("a[href]").first().attr("href"));
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
          url: href || page.url,
          summary: `${programme} programı açık çağrısı. Son başvuru: ${deadlineText}.`,
          confidence: "orta",
        });
      });
      return dedupe(items).slice(0, 80);
    },
    async fetchDetailPage() {
      return null;
    },
    async extractDetailData() {
      return {};
    },
    async healthCheck() {
      return { ok: true, url: sourceUrl };
    },
  };
}
