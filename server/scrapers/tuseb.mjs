import { extractMoney, getHtml, loadHtml, normalizeWhitespace, parseDateLoose, slug, statusFromDeadline } from "./utils.mjs";

export function createTusebScraper() {
  const sourceUrl = "https://tbys.tuseb.gov.tr/";
  return {
    id: "tuseb",
    async discover() {
      return [sourceUrl];
    },
    async fetchListPage(url = sourceUrl) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
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
          url: page.url,
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
          url: page.url,
          summary: "TÜSEB TBYS portalında aktif çağrı listesi bulunur; SPA içerik yapısı nedeniyle detaylar portal üzerinde doğrulanmalıdır.",
          confidence: "kontrol",
        });
      }
      return items.slice(0, 10);
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
