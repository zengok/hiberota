import { decodeEntities, normalizeWhitespace, parseUsDate } from "./utils.mjs";

export function createGrantsGovScraper() {
  const sourceUrl = "https://api.grants.gov/v1/api/search2";
  return {
    id: "grants-gov",
    async discover() {
      return [sourceUrl];
    },
    async fetchListPage(url = sourceUrl) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(process.env.SOURCE_TIMEOUT_MS || 12000));
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": process.env.SOURCE_USER_AGENT || "ProjeYakalama/1.0" },
        body: JSON.stringify({
          rows: 25,
          keyword: "research innovation technology",
          oppStatuses: "forecasted|posted",
          sortBy: "closeDate|asc",
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { url, json: await response.json() };
    },
    async extractListItems(page) {
      const hits = page.json?.data?.oppHits || [];
      return hits.map((hit) => ({
        id: `grantsgov-${hit.id}`,
        externalId: hit.number,
        title: normalizeWhitespace(decodeEntities(hit.title)),
        funder: hit.agencyName || hit.agency || hit.agencyCode || "Grants.gov",
        source: "Grants.gov Search2 API",
        scope: "Yurtdışı",
        category: "ABD federal hibe",
        support: "Detay sayfasında belirtilir",
        deadline: parseUsDate(hit.closeDate),
        publishedAt: parseUsDate(hit.openDate),
        status: hit.oppStatus === "forecasted" ? "upcoming" : "open",
        url: `https://www.grants.gov/search-results-detail/${hit.id}`,
        summary: `${hit.number || ""} ${hit.agencyCode || ""} ${hit.alnist?.join(", ") || ""}`.trim(),
        confidence: "yüksek",
      }));
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
