import test from "node:test";
import assert from "node:assert/strict";
import { filterCalls, normalizeSearchText, scopeFromParam } from "../server/services/call-filter-service.mjs";

const calls = [
  {
    id: "a",
    title: "Yapay Zeka KOBİ Çağrısı",
    funder: "TÜBİTAK",
    category: "Ar-Ge",
    categories: ["Yapay zeka ve dijital teknolojiler"],
    thematicArea: "Dijital dönüşüm",
    supportType: "Hibe",
    support: "Makine öğrenmesi ve prototip geliştirme desteği",
    scope: "Ulusal",
    status: "open",
    normalizedStatus: "OPEN",
    deadline: "2099-07-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    budgetMax: 1500000,
    currency: "TRY",
    country: "Türkiye",
    eligibleCountries: ["Türkiye"],
    targetAudience: ["KOBİ'ler, girişimler ve şirketler"],
    isOfficial: true,
    confidenceScore: 95,
  },
  {
    id: "b",
    title: "Horizon Europe Akademi Çağrısı",
    funder: "European Commission",
    category: "Horizon",
    categories: ["Sağlık ve yaşam bilimleri"],
    scope: "Avrupa",
    status: "open",
    normalizedStatus: "OPEN",
    deadline: "2099-05-01T00:00:00.000Z",
    publishedAt: "2026-02-01T00:00:00.000Z",
    budgetMax: 500000,
    currency: "EUR",
    country: "Belçika",
    eligibleCountries: ["Türkiye", "Almanya"],
    targetAudience: ["Akademisyenler ve araştırmacılar"],
    sourceType: "secondary",
    confidenceScore: 65,
  },
  {
    id: "c",
    title: "Kapanmış Program",
    funder: "Örnek Kurum",
    category: "Eğitim",
    scope: "Yurtdışı",
    status: "closed",
    normalizedStatus: "CLOSED",
    deadline: "2020-01-01T00:00:00.000Z",
    publishedAt: "2026-03-01T00:00:00.000Z",
    budgetMax: 100000,
    currency: "USD",
    country: "ABD",
    eligibleInstitutions: ["Belediye"],
  },
];

test("scopeFromParam normalizes public API aliases", () => {
  assert.equal(scopeFromParam("eu"), "Avrupa");
  assert.equal(scopeFromParam("international"), "Yurtdışı");
  assert.equal(scopeFromParam("turkiye"), "Ulusal");
});

test("normalizeSearchText supports Turkish-insensitive search", () => {
  assert.equal(normalizeSearchText("Yapay Zekâ Çağrısı"), "yapay zeka cagrisi");
  assert.equal(normalizeSearchText("KOBİ Ar-Ge"), "kobi ar ge");
});

test("filterCalls applies query, scope, audience, budget, officialOnly and sorting", () => {
  assert.deepEqual(filterCalls(calls, { query: "yapay zeka", scope: "national" }).map((call) => call.id), ["a"]);
  assert.deepEqual(filterCalls(calls, { keyword: "makine öğrenmesi" }).map((call) => call.id), ["a"]);
  assert.deepEqual(filterCalls(calls, { keyword: "digital-ai" }).map((call) => call.id), ["a"]);
  assert.deepEqual(filterCalls(calls, { audience: "akademisyen", scope: "eu" }).map((call) => call.id), ["b"]);
  assert.deepEqual(filterCalls(calls, { audience: "kamu", status: "all" }).map((call) => call.id), ["c"]);
  assert.deepEqual(filterCalls(calls, { thematicArea: "sağlık", country: "Türkiye", currency: "EUR" }).map((call) => call.id), ["b"]);
  assert.deepEqual(filterCalls(calls, { deadlineFrom: "2099-06-01", deadlineTo: "2099-08-01" }).map((call) => call.id), ["a"]);
  assert.deepEqual(filterCalls(calls, { budgetMax: "600000", status: "all" }).map((call) => call.id), ["c", "b"]);
  assert.deepEqual(filterCalls(calls, { budgetMin: "1000000" }).map((call) => call.id), ["a"]);
  assert.deepEqual(filterCalls(calls, { officialOnly: "true", status: "all" }).map((call) => call.id), ["a"]);
  assert.deepEqual(filterCalls(calls, { status: "all", sort: "newest" }).map((call) => call.id), ["c", "b", "a"]);
});
