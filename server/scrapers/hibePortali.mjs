import { absoluteUrl, dedupe, getHtml, loadHtml, normalizeWhitespace, parseDateLoose, slug, statusFromDeadline } from "./utils.mjs";

const SOURCE_URL = "https://hibeportali.com/kademeli-cagrilar/";
const SOURCE_NAME = "HibePortalı Kademeli Çağrılar";

function pageUrl(pageNumber) {
  return pageNumber <= 1 ? SOURCE_URL : `${SOURCE_URL}page/${pageNumber}/`;
}

function decodeText($, value = "") {
  return normalizeWhitespace($("<span>").html(value).text());
}

function extractMaxPage($) {
  const pages = $("a[href*='/kademeli-cagrilar/page/']")
    .map((_, link) => {
      const match = String($(link).attr("href") || "").match(/\/page\/(\d+)\/?/);
      return match ? Number(match[1]) : 0;
    })
    .get()
    .filter(Boolean);
  const titleMatch = normalizeWhitespace($("title").text()).match(/Sayfa\s+\d+\s*\/\s*(\d+)/i);
  return Math.max(1, Number(titleMatch?.[1] || 0), ...pages);
}

function textAfterLabel(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalizeWhitespace(text.match(new RegExp(`${escaped}\\s*:?\\s*([^\\n]+)`, "i"))?.[1] || "");
}

function strongTextAfterLabel($, card, label) {
  const target = card
    .find("span, div")
    .filter((_, element) => normalizeWhitespace($(element).clone().children().remove().end().text()).includes(label))
    .first();
  const strong = normalizeWhitespace(target.find("strong").first().text());
  if (strong) return strong;
  const text = normalizeWhitespace(target.text());
  return textAfterLabel(text, label);
}

export function extractHibePortaliArchiveItems(html, url = SOURCE_URL) {
  const $ = loadHtml(html);
  const items = [];

  $("article").each((_, article) => {
    const card = $(article);
    const titleLink = card.find("h2 a[href]").first();
    const title = normalizeWhitespace(titleLink.text());
    const href = absoluteUrl(url, titleLink.attr("href"));
    if (!title || !href || !href.includes("/kademeli-cagrilar/")) return;

    const cardText = normalizeWhitespace(card.text());
    const deadlineText = strongTextAfterLabel($, card, "Son Başvuru") || textAfterLabel(cardText, "Son Başvuru");
    const deadline = parseDateLoose(deadlineText);
    if (!deadline || statusFromDeadline(deadline) !== "open") return;

    const budgetText = strongTextAfterLabel($, card, "Bütçe") || textAfterLabel(cardText, "Bütçe");
    const summary = normalizeWhitespace(card.find("p").first().text());
    const tagTexts = card
      .find("span")
      .map((__, span) => normalizeWhitespace($(span).text()))
      .get()
      .filter((value) => value && !/kademeli çağrılar|son başvuru|bütçe|gün kaldı|bugün son gün|yakında kapanacak|açık|kapandı/i.test(value));

    items.push({
      id: `hibeportali-${slug(title)}`,
      externalId: href.match(/\/kademeli-cagrilar\/([^/]+)\//)?.[1] || "",
      title: decodeText($, title),
      funder: "Horizon Europe / Cascade Funding",
      source: SOURCE_NAME,
      scope: "Avrupa",
      category: "Kademeli fonlama",
      support: budgetText ? `Bütçe: ${budgetText}` : "Çağrı detayında belirtilir",
      deadline,
      publishedAt: null,
      status: "open",
      url: href,
      sourceUrl: url,
      summary: summary
        ? decodeText($, summary)
        : `HibePortalı kademeli çağrı arşivinde listelenen açık çağrı. Son başvuru: ${deadlineText}.`,
      categories: [...new Set(tagTexts)].slice(0, 12),
      targetAudience: ["KOBİ'ler", "Start-up'lar", "Araştırma kurumları/Üniversiteler"],
      eligibleCountries: ["EU", "TR"],
      confidence: "orta",
      requiresManualReview: true,
    });
  });

  return dedupe(items);
}

export function createHibePortaliScraper() {
  return {
    id: "hibeportali-cascade",
    async discover() {
      const html = await getHtml(SOURCE_URL);
      const $ = loadHtml(html);
      const maxPage = Math.min(Number(process.env.HIBEPORTALI_MAX_PAGES || extractMaxPage($) || 15), 25);
      return Array.from({ length: maxPage }, (_, index) => pageUrl(index + 1));
    },
    async fetchListPage(url = SOURCE_URL) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      return extractHibePortaliArchiveItems(page.html, page.url).slice(0, 180);
    },
    async fetchDetailPage(item) {
      return item?.url ? { url: item.url, html: await getHtml(item.url) } : null;
    },
    async extractDetailData(page, item = {}) {
      if (!page) return {};
      const $ = loadHtml(page.html);
      const bodyText = normalizeWhitespace($("main, body").text());
      const officialLinks = $("a[href^='http']")
        .map((_, link) => absoluteUrl(page.url, $(link).attr("href")))
        .get()
        .filter((href) => !href.includes("hibeportali.com") && !href.includes("linkedin.com"))
        .slice(0, 10);
      return {
        description: bodyText.slice(0, 2400),
        applicationUrl: officialLinks[0] || item.applicationUrl || "",
        attachments: $('a[href$=".pdf"], a[href$=".docx"], a[href$=".xlsx"], a[href$=".zip"]')
          .map((_, link) => ({ url: absoluteUrl(page.url, $(link).attr("href")), name: normalizeWhitespace($(link).text()) || "Belge" }))
          .get()
          .slice(0, 20),
      };
    },
    async healthCheck() {
      return { ok: true, url: SOURCE_URL };
    },
  };
}
