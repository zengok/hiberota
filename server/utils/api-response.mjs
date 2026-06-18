import crypto from "node:crypto";

export function parsePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function createWeakEtag(payload) {
  const hash = crypto.createHash("sha1").update(JSON.stringify(payload)).digest("base64url");
  return `W/"${hash}"`;
}

export function paginatedResponse({ data, page, pageSize, total, requestId, generatedAt = new Date().toISOString(), extraMeta = {} }) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
    meta: {
      generatedAt,
      requestId,
      ...extraMeta,
    },
  };
}

export function sendJsonWithEtag(req, res, payload, { cacheControl = "private, max-age=60, stale-while-revalidate=300" } = {}) {
  const etag = createWeakEtag(payload);
  res.set("ETag", etag);
  res.set("Cache-Control", cacheControl);
  if (req.get("if-none-match") === etag) return res.status(304).end();
  return res.json(payload);
}
