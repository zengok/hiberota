import {
  absoluteUrl,
  classifyScope,
  dedupe,
  extractMoney,
  getHtml,
  loadHtml,
  normalizeWhitespace,
  parseDateLoose,
  slug,
  statusFromDeadline,
} from "./utils.mjs";

const DOCUMENT_SELECTOR = 'a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"], a[href$=".xls"], a[href$=".xlsx"], a[href$=".zip"]';

function isLikelyCall(title = "", context = "") {
  const text = `${title} ${context}`;
  if (/(procurement|webinar)/i.test(text)) return false;
  if (/(ihale|sat[ıi]n\s*alma|tender|sonu[çc]|kazanan|reddi|red\s+listesi|anket|yar[ıi][şs]ma|[öo]d[üu]l)/i.test(title)) return false;
  return /(çağrı|cagri|başvuru|basvuru|teklif|hibe|IPARD|Erasmus\+|ESC|Dayanışma)/i.test(text);
}

function extractPublishedAt($row) {
  const raw =
    $row.find("time[datetime]").first().attr("datetime") ||
    $row.find(".date, .tarih, .views-field-created, .news-date").first().text() ||
    $row.text();
  return parseDateLoose(raw);
}

function extractDeadline(text = "") {
  const explicit =
    text.match(/(?:son\s+başvuru|son\s+basvuru|başvurular[^.;]{0,35}?kadar|deadline)[^0-9A-Za-zÇĞİÖŞÜçğıöşü]{0,12}([^.;\n]{6,60})/i)?.[1] ||
    text.match(/(?:başvurular|başvuru)[^.;\n]{0,80}?(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i)?.[1] ||
    text.match(/(?:başvurular|başvuru)[^.;\n]{0,80}?(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+20\d{2})/i)?.[1];
  return parseDateLoose(explicit || "");
}

function extractAttachments($, baseUrl) {
  return $(DOCUMENT_SELECTOR)
    .map((_, link) => ({
      url: absoluteUrl(baseUrl, $(link).attr("href")),
      name: normalizeWhitespace($(link).text()) || "Belge",
    }))
    .get()
    .filter((item, index, list) => item.url && index === list.findIndex((candidate) => candidate.url === item.url))
    .slice(0, 20);
}

function buildGenericHtmlScraper({ id, sourceUrl, funder, sourceName, category, programme, selectors, maxItems = 25 }) {
  return {
    id,
    async discover() {
      return [sourceUrl];
    },
    async fetchListPage(url = sourceUrl) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
      const items = [];
      const rows = $(selectors.rows).length ? $(selectors.rows) : $("article, .duyuru, .haber, .news, .card, tr, li");
      rows.each((_, row) => {
        const $row = $(row);
        const $link = $row.find(selectors.link || "a[href]").first();
        const href = selectors.usePageUrl ? page.url : absoluteUrl(page.url, $link.attr("href"));
        if (!href || /^javascript:/i.test(href)) return;
        const title = normalizeWhitespace($row.find("h1,h2,h3,h4,h5,strong").first().text() || $link.text());
        const context = normalizeWhitespace($row.text());
        if (!title || title.length < 8 || !isLikelyCall(title, context)) return;
        const deadline = extractDeadline(context);
        const publishedAt = extractPublishedAt($row);
        items.push({
          id: `${id}-${slug(title)}`,
          title,
          funder,
          institution: funder,
          source: sourceName,
          scope: classifyScope(funder, title),
          category,
          programme,
          support: extractMoney(context) || "Resmî çağrı dokümanında belirtilir",
          deadline,
          publishedAt,
          status: statusFromDeadline(deadline),
          url: href || page.url,
          summary: context.slice(0, 320),
          confidence: deadline ? "yüksek" : "kontrol",
        });
      });
      return dedupe(items).slice(0, maxItems);
    },
    async fetchDetailPage(item) {
      return item?.url ? { url: item.url, html: await getHtml(item.url) } : null;
    },
    async extractDetailData(page, item) {
      if (!page) return {};
      const $ = loadHtml(page.html);
      const text = normalizeWhitespace($("main, article, body").first().text());
      const attachments = extractAttachments($, page.url);
      const deadline = item?.deadline || extractDeadline(text);
      return {
        description: text.slice(0, 2400),
        deadline,
        status: statusFromDeadline(deadline),
        guideUrl: attachments.find((attachment) => /rehber|guide|çağrı|cagri|ilan/i.test(attachment.name))?.url || attachments[0]?.url || "",
        attachments,
      };
    },
    async healthCheck() {
      return { ok: true, url: sourceUrl };
    },
  };
}

export function createKosgebScraper() {
  return buildGenericHtmlScraper({
    id: "kosgeb",
    sourceUrl: "https://www.kosgeb.gov.tr/",
    funder: "KOSGEB",
    sourceName: "KOSGEB Resmî Duyurular",
    category: "KOBİ ve girişimcilik desteği",
    programme: "KOSGEB Destekleri",
    selectors: { rows: ".container-news, .duyuru, .haber, .news, article", link: "h5.title a[href], a[href]" },
  });
}

export function createTkdkScraper() {
  return buildGenericHtmlScraper({
    id: "tkdk",
    sourceUrl: "https://www.tkdk.gov.tr/ProjeIslemleri/CagriIlanArsiv",
    funder: "Tarım ve Kırsal Kalkınmayı Destekleme Kurumu",
    sourceName: "TKDK Başvuru Çağrı İlanları",
    category: "Tarım ve kırsal kalkınma",
    programme: "IPARD",
    selectors: { rows: ".feature-box.well, table tr, .content li, article", link: "a[href]" },
    maxItems: 40,
  });
}

export function createTurkiyeUlusalAjansiScraper() {
  return buildGenericHtmlScraper({
    id: "turkiye-ulusal-ajansi",
    sourceUrl: "https://www.ua.gov.tr/anasayfa/icerikler/teklif-cagrilari-ve-rehberler/",
    funder: "Türkiye Ulusal Ajansı",
    sourceName: "Türkiye Ulusal Ajansı Teklif Çağrıları ve Rehberler",
    category: "Eğitim, gençlik ve Avrupa programları",
    programme: "Erasmus+ / Avrupa Dayanışma Programı",
    selectors: { rows: ".card-content, main article, .content li", link: "a[href]", usePageUrl: true },
    maxItems: 30,
  });
}
