import { absoluteUrl, dedupe, extractMoney, getHtml, loadHtml, normalizeWhitespace, parseDateLoose, slug, statusFromDeadline } from "./utils.mjs";

const TUSEB_LIST_URLS = [
  "https://tbys.tuseb.gov.tr/",
  "https://proje-destek.tuseb.gov.tr/",
  "https://proje-destek.tuseb.gov.tr/a-grubu-proje-destekleri",
  "https://proje-destek.tuseb.gov.tr/b-grubu-proje-destekleri",
  "https://proje-destek.tuseb.gov.tr/c-grubu-proje-destekleri",
  "https://www.tuseb.gov.tr/haberler/2026-yili-tuseb-proje-desteklerine-iliskin-cagri-ayrintilari-yayimlandi-20260127",
  "https://www.tuseb.gov.tr/haberler/2026-cagri-takvimine-iliskin-on-bilgiler-yayimlandi-20260116",
];

function isLikelyTusebCall(title = "", context = "") {
  const text = `${title} ${context}`;
  if (/^(Anasayfa|[ABC]\s+Grubu Proje Destekleri|Çağrı Programları|Proje Destekleri|Proje Üst Limitleri|Proje Çağrı Takvimi|Proje Yönetimi ve Destek Daire Başkanlığı)$/i.test(normalizeWhitespace(title))) return false;
  if (/(sonu[çc]lar[ıi]?|sonu[çc] a[çc][ıi]kland[ıi]|webinar|e[ğg]itim|hakem|neden|[öo]d[üu]l|yar[ıi][şs]ma|s[üu]reci|etkinlik|haber|duyuru(?!.*çağrı))/i.test(title)) return false;
  return /([çc]a[ğg]r[ıi]\s+(ayr[ıi]nt[ıi]lar[ıi]|takvimi|metni|a[çc][ıi]ld[ıi])|proje destek program[ıi]|[ABC]\s*Grubu.*(proje|destek)|AR-GE|ARGE)/i.test(title);
}

function titleFromLink($, link) {
  const $link = $(link);
  const href = $link.attr("href") || "";
  const raw = normalizeWhitespace(
    $link.text() ||
    $link.find("h1,h2,h3,h4,h5,h6").first().text() ||
    $link.find("img[alt]").first().attr("alt") ||
    $link.attr("title") ||
    $link.attr("aria-label") ||
    href,
  );
  if (/^t[ıi]klay[ıi]n[ıi]z\.?$/i.test(raw) && /\.pdf(?:$|[?#])/i.test(href)) {
    const filename = decodeURIComponent(href.split("/").pop() || "").replace(/\.pdf(?:$|[?#].*)/i, "");
    return normalizeWhitespace(`TÜSEB ${filename.toUpperCase("tr-TR")} Proje Destek Programı Çağrı Metni`);
  }
  return raw;
}

function buildCall({ idPrefix, title, context, url, sourceUrl, guideUrl = "" }) {
  const deadline = parseDateLoose(context);
  const support = extractMoney(context);
  return {
    id: `${idPrefix}-${slug(`${title}-${url}`)}`,
    title,
    funder: "TÜSEB",
    institution: "Türkiye Sağlık Enstitüleri Başkanlığı",
    source: "TÜSEB Proje Destekleri",
    sourceId: "tuseb",
    scope: "Ulusal",
    category: "Sağlık Ar-Ge",
    programme: title.match(/\b[ABC]\s*Grubu/i)?.[0] || "TÜSEB Proje Destek Programı",
    support: support || "Çağrı metninde belirtilir",
    deadline,
    publishedAt: null,
    status: statusFromDeadline(deadline),
    url,
    officialUrl: url,
    guideUrl,
    summary: normalizeWhitespace(context || title).slice(0, 520),
    confidence: deadline ? "yüksek" : "orta",
    sourceUrl,
  };
}

export function createTusebScraper() {
  const sourceUrl = "https://tbys.tuseb.gov.tr/";
  return {
    id: "tuseb",
    async discover() {
      return TUSEB_LIST_URLS;
    },
    async fetchListPage(url = sourceUrl) {
      return { url, html: await getHtml(url) };
    },
    async extractListItems(page) {
      const $ = loadHtml(page.html);
      const text = normalizeWhitespace($("body").text());
      const items = [];
      const matches = text.matchAll(/(20\d{2}[^₺]{8,120}?(?:PROJE|AR-GE|ARGE|DESTEK|[ÇC]A[ĞG]RI)[^₺]{0,180}?(?:₺[\d.,]+|son tarih[^.]{0,40}|başvuru[^.]{0,80}))/gi);
      for (const match of matches) {
        const chunk = normalizeWhitespace(match[1]);
        if (!isLikelyTusebCall(chunk, chunk)) continue;
        items.push(buildCall({
          idPrefix: "tuseb-text",
          title: chunk.replace(/₺.*/, "").slice(0, 180),
          context: chunk,
          url: page.url,
          sourceUrl: page.url,
        }));
      }

      $("article, .card, .swiper-slide, li, tr, .content, .haber-detay, #content-body-haber-detail").each((_, row) => {
        const $row = $(row);
        const context = normalizeWhitespace($row.text());
        const $link = $row.find("a[href]").filter((__, link) => {
          const href = $(link).attr("href") || "";
          const title = titleFromLink($, link);
          return /\.pdf(?:$|[?#])/i.test(href) || isLikelyTusebCall(title, context);
        }).first();
        if (!$link.length) return;
        const href = $link.attr("href");
        const title = titleFromLink($, $link) || normalizeWhitespace($row.find("h1,h2,h3,h4,h5,h6").first().text());
        if (!title || !isLikelyTusebCall(title, context)) return;
        const url = absoluteUrl(page.url, href);
        items.push(buildCall({
          idPrefix: "tuseb-link",
          title,
          context,
          url,
          guideUrl: /\.pdf(?:$|[?#])/i.test(url) ? url : "",
          sourceUrl: page.url,
        }));
      });

      if (!items.length && page.url === sourceUrl) {
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
      return dedupe(items).slice(0, Number(process.env.TUSEB_CALL_LIMIT || 30));
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
