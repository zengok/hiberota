import test from "node:test";
import assert from "node:assert/strict";
import { createWeakEtag, paginatedResponse, parsePositiveInt } from "../server/utils/api-response.mjs";

test("parsePositiveInt clamps pagination values", () => {
  assert.equal(parsePositiveInt("2", 1, { max: 100 }), 2);
  assert.equal(parsePositiveInt("0", 1, { max: 100 }), 1);
  assert.equal(parsePositiveInt("500", 24, { max: 100 }), 100);
  assert.equal(parsePositiveInt("abc", 24, { max: 100 }), 24);
});

test("paginatedResponse follows v1 envelope", () => {
  const response = paginatedResponse({
    data: [{ id: "a" }],
    page: 2,
    pageSize: 24,
    total: 49,
    requestId: "req-123",
    generatedAt: "2026-06-18T00:00:00.000Z",
  });

  assert.deepEqual(response.pagination, { page: 2, pageSize: 24, total: 49, totalPages: 3 });
  assert.equal(response.meta.requestId, "req-123");
  assert.equal(response.data[0].id, "a");
});

test("createWeakEtag is stable for equivalent payloads", () => {
  const payload = { data: [{ id: "a" }], pagination: { page: 1 } };
  const etag = createWeakEtag(payload);
  assert.equal(etag, createWeakEtag(payload));
  assert.equal(etag.startsWith('W/"'), true);
  assert.equal(etag.endsWith('"'), true);
});
