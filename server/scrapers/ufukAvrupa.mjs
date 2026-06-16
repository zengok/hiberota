import { dedupe, extractMoney, getHtml, loadHtml, normalizeWhitespace, parseDateLoose, slug, statusFromDeadline } from "./utils.mjs";

export function createUfukAvrupaScraper() {
  const sourceUrl = "https://ufukavrupa.org.tr/tr";
  return {
    id: "ufuk-avrupa",
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
          url: page.url,
          summary: chunk,
          confidence: deadline ? "yüksek" : "orta",
        });
      }
      return dedupe(items).slice(0, 15);
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
