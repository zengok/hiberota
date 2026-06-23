import { decodeEntities, dedupe, normalizeWhitespace, parseDateLoose, slug, statusFromDeadline } from "./utils.mjs";

const API_URL = "https://api.tech.ec.europa.eu/search-api/prod/rest/search";
const STATUS_LABELS = {
  31094501: "forthcoming",
  31094502: "open",
  31094503: "closed",
};

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function stripHtml(value = "") {
  return decodeEntities(String(value).replace(/<[^>]*>/g, " "));
}

function futureDeadline(values = [], now = Date.now()) {
  const candidates = (Array.isArray(values) ? values : [values])
    .map((value) => parseDateLoose(value) || (value ? new Date(value).toISOString() : null))
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return candidates.find((date) => {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end.getTime() >= now;
  }) || candidates.at(-1) || null;
}

function portalUrl(result) {
  const code =
    first(result.metadata?.identifier) ||
    first(result.metadata?.callIdentifier) ||
    result.reference ||
    result.url?.match(/topicDetails\/([^/.]+)\.json/i)?.[1] ||
    "";
  return code
    ? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent(code)}`
    : result.url;
}

async function postSearch({ pageSize, pageNumber }) {
  const query = {
    bool: {
      must: [
        { terms: { type: ["1", "2", "8"] } },
        { terms: { status: ["31094501", "31094502"] } },
        { term: { programmePeriod: "2021 - 2027" } },
      ],
    },
  };
  const displayFields = [
    "type",
    "identifier",
    "reference",
    "callccm2Id",
    "title",
    "status",
    "caName",
    "startDate",
    "deadlineDate",
    "deadlineModel",
    "frameworkProgramme",
    "typesOfAction",
    "descriptionByte",
    "keywords",
    "budgetOverviewJSONItem",
  ];
  const form = new FormData();
  form.set("query", new Blob([JSON.stringify(query)], { type: "application/json" }), "blob");
  form.set("languages", new Blob([JSON.stringify(["en"])], { type: "application/json" }), "blob");
  form.set("sort", new Blob([JSON.stringify({ field: "sortStatus", order: "ASC" })], { type: "application/json" }), "blob");
  form.set("displayFields", new Blob([JSON.stringify(displayFields)], { type: "application/json" }), "blob");

  const response = await fetch(`${API_URL}?apiKey=SEDIA&text=***&pageSize=${pageSize}&pageNumber=${pageNumber}`, {
    method: "POST",
    headers: {
      "user-agent": "Mozilla/5.0 Hiberota/1.0",
      "x-requested-with": "XMLHttpRequest",
      origin: "https://ec.europa.eu",
      referer: "https://ec.europa.eu/",
    },
    body: form,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function normalizeResult(result) {
  const metadata = result.metadata || {};
  const title = normalizeWhitespace(stripHtml(first(metadata.title) || result.content || result.summary || ""));
  const deadline = futureDeadline(metadata.deadlineDate || metadata.deadlineDates || []);
  const statusCode = first(metadata.status);
  const statusLabel = STATUS_LABELS[statusCode] || "";
  if (!title || statusLabel === "closed") return null;
  const url = portalUrl(result);
  const callCode = first(metadata.identifier) || first(metadata.callIdentifier) || result.reference || "";
  const description = normalizeWhitespace(stripHtml(first(metadata.descriptionByte) || result.summary || ""));
  const keywords = (metadata.keywords || []).slice(0, 8).join(", ");
  return {
    id: `eu-funding-tenders-${slug(`${callCode}-${title}`)}`,
    externalId: result.reference || callCode,
    callCode,
    title,
    funder: "European Commission",
    institution: "European Commission",
    source: "EU Funding & Tenders Portal",
    sourceId: "eu-funding-tenders",
    scope: "Avrupa",
    category: "AB fon çağrısı",
    programme: first(metadata.callTitle) || first(metadata.frameworkProgramme) || "EU Funding Programme",
    support: "Funding & Tenders Portal detayında belirtilir",
    deadline,
    openingDate: parseDateLoose(first(metadata.startDate) || ""),
    publishedAt: parseDateLoose(first(metadata.startDate) || ""),
    status: statusFromDeadline(deadline),
    url,
    officialUrl: url,
    applicationUrl: url,
    summary: normalizeWhitespace(`${description || title} ${keywords ? `Keywords: ${keywords}` : ""}`).slice(0, 700),
    description: description.slice(0, 1800),
    confidence: deadline ? "yüksek" : "orta",
    country: "EU",
    language: "en",
  };
}

export function createEuFundingTendersScraper() {
  return {
    id: "eu-funding-tenders",
    async discover() {
      return [API_URL];
    },
    async fetchListPage() {
      const pageSize = Number(process.env.EU_FUNDING_TENDERS_PAGE_SIZE || 50);
      const pageNumber = Number(process.env.EU_FUNDING_TENDERS_PAGE_NUMBER || 1);
      return { url: API_URL, json: await postSearch({ pageSize, pageNumber }) };
    },
    async extractListItems(page) {
      const items = (page.json?.results || []).map(normalizeResult).filter(Boolean);
      return dedupe(items).slice(0, Number(process.env.EU_FUNDING_TENDERS_LIMIT || 50));
    },
    async fetchDetailPage() {
      return null;
    },
    async extractDetailData() {
      return {};
    },
    async healthCheck() {
      return { ok: true, url: API_URL };
    },
  };
}
