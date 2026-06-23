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

function extractDateByLabel($, $row, labelPattern) {
  let found = "";
  $row.find(".item-date").each((_, node) => {
    const $node = $(node);
    const label = normalizeWhitespace($node.find("span").first().text());
    const dateText = normalizeWhitespace($node.find(".date-text").first().text());
    const text = normalizeWhitespace(`${label} ${dateText || $node.text()}`);
    if (!found && labelPattern.test(text)) found = text;
  });
  return parseDateLoose(found);
}

function isSupportCard(title = "", context = "") {
  const text = `${title} ${context}`;
  if (/(sonu[çc]lar[ıi]?|sonu[çc] a[çc][ıi]kland[ıi]|ihale|etkinlik|haber|rapor)/i.test(title)) return false;
  return /(destek program[ıi]|teknik destek|fizibilite deste[ğg]i|mali destek|finansman destek|sogep|ba[şs]vurular[ıi]? ba[şs]lad[ıi]|teklif [çc]a[ğg]r[ıi]s[ıi])/i.test(text);
}

export function createDevelopmentAgenciesScraper() {
  const sourceUrl = "https://ka.gov.tr/destekler";
  return {
    id: "ka-development-agencies",
    async discover() {
      return [sourceUrl];
    },
    async fetchListPage(url = sourceUrl) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
      const items = [];
      const rows = $("a.item-card, .item-card, .v-list-item").filter((_, row) => {
        const text = normalizeWhitespace($(row).text());
        return /Teklif Teslimi|Başlangıç Tarihi|Bitiş Tarihi|Kalkınma Ajansı/i.test(text);
      });

      rows.each((_, row) => {
        const $row = $(row);
        const title = normalizeWhitespace($row.find(".item-description").first().text() || $row.find("h1,h2,h3,h4,a").first().text());
        const context = normalizeWhitespace($row.text());
        if (!title || !isSupportCard(title, context)) return;
        const agency =
          normalizeWhitespace($row.find(".i-agency").first().attr("title")) ||
          normalizeWhitespace($row.find(".i-agency-name").first().text()) ||
          "Kalkınma Ajansı";
        const deadline = extractDateByLabel($, $row, /Biti[şs] Tarihi/i) || parseDateLoose(context);
        const openingDate = extractDateByLabel($, $row, /Ba[şs]lang[ıi][çc] Tarihi/i);
        const href = $row.attr("href") || $row.find("a[href]").first().attr("href") || page.url;
        items.push({
          id: `ka-${slug(`${agency}-${title}`)}`,
          title: `${agency}: ${title}`,
          funder: agency,
          institution: agency,
          source: "Kalkınma Ajansları Güncel Destekler",
          sourceId: "ka-development-agencies",
          scope: "Ulusal",
          category: "Kalkınma ajansı desteği",
          programme: title,
          support: extractMoney(context) || "Başvuru rehberinde belirtilir",
          openingDate,
          deadline,
          publishedAt: null,
          status: statusFromDeadline(deadline),
          url: absoluteUrl(page.url, href),
          officialUrl: absoluteUrl(page.url, href),
          summary: context.slice(0, 420),
          confidence: deadline ? "yüksek" : "orta",
        });
      });

      return dedupe(items).slice(0, Number(process.env.KA_SUPPORT_LIMIT || 80));
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
