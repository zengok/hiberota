import { absoluteUrl, dedupe, getHtml, loadHtml, normalizeWhitespace, parseDateLoose, slug, statusFromDeadline } from "./utils.mjs";

export function createEurekaScraper() {
  const sourceUrl = "https://www.eurekanetwork.org/programmes-and-calls/";
  return {
    id: "eureka",
    async discover() {
      return [sourceUrl];
    },
    async fetchListPage(url = sourceUrl) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
      const items = [];
      $("h3").each((_, h3) => {
        const title = normalizeWhitespace($(h3).text());
        if (!title || /^(calls|open calls)$/i.test(title) || /select your options|programmes|insights|about us/i.test(title)) return;
        const card = $(h3).closest(".relative, article, .rounded-lg");
        const context = normalizeWhitespace(card.text() || $(h3).parent().text());
        const deadline = parseDateLoose(context.match(/Deadline:\s*([^|+]+)/i)?.[1] || context);
        if (!deadline && !/call|challenge|projects|session/i.test(title)) return;
        const href = absoluteUrl(page.url, card.find("a[href]").last().attr("href"));
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
          url: href || page.url,
          summary: context.slice(0, 260),
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
      return {
        description: normalizeWhitespace($("main, body").text()).slice(0, 2000),
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
