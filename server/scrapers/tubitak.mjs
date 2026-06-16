import {
  absoluteUrl,
  classifyScope,
  dedupe,
  extractMoney,
  getHtml,
  isNonApplicationAnnouncement,
  loadHtml,
  normalizeWhitespace,
  parseDateLoose,
  slug,
  statusFromDeadline,
} from "./utils.mjs";

export function createTubitakScraper() {
  const sourceUrl = "https://tubitak.gov.tr/tr/duyuru";
  return {
    id: "tubitak",
    async discover() {
      return [sourceUrl];
    },
    async fetchListPage(url = sourceUrl) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
      const items = [];
      $(".view-content .views-row").each((_, row) => {
        const $row = $(row);
        const $link = $row.find(".views-field-title a[href]").first();
        const title = normalizeWhitespace($link.text());
        if (!/(çağrı|başvuru|hibe|destek\s+program|destek\s+çağr|programı\s+başvuru|proje\s+çağr)/i.test(title) || title.length < 18) return;
        const href = absoluteUrl(page.url, $link.attr("href"));
        const context = normalizeWhitespace($row.text());
        const summary = normalizeWhitespace($row.find(".views-field-field-ozet").text()) || context;
        if (isNonApplicationAnnouncement({ title, summary, source: "TÜBİTAK Duyurular" })) return;
        const deadlineMatch = context.match(/(?:son başvuru|başvurular|deadline)[^.;:]*[: ]\s*([^.;]{6,40})/i);
        const deadline = deadlineMatch ? parseDateLoose(deadlineMatch[1]) : null;
        const publishedAt = $row.find("time[datetime]").first().attr("datetime") || parseDateLoose($row.find(".views-field-created").text());
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
    },
    async fetchDetailPage(item) {
      return item?.url ? { url: item.url, html: await getHtml(item.url) } : null;
    },
    async extractDetailData(page) {
      if (!page) return {};
      const $ = loadHtml(page.html);
      const text = normalizeWhitespace($("body").text());
      return {
        description: text.slice(0, 2000),
        guideUrl: absoluteUrl(page.url, $('a[href$=".pdf"], a[href*="rehber"], a[href*="guide"]').first().attr("href")),
        attachments: $('a[href$=".pdf"], a[href$=".docx"], a[href$=".xlsx"], a[href$=".zip"]')
          .map((_, link) => ({ url: absoluteUrl(page.url, $(link).attr("href")), name: normalizeWhitespace($(link).text()) || "Belge" }))
          .get()
          .slice(0, 20),
      };
    },
    async healthCheck() {
      return { ok: true, url: sourceUrl };
    },
  };
}
