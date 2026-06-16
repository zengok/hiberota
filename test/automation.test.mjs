import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPageType,
  computeStatus,
  contentHash,
  dedupeAndFlag,
  isSafeCrawlerUrl,
  matchFundingSource,
  normalizeCallRecord,
  parseImportantDates,
} from "../server/automation.mjs";

test("parses Turkish and ISO deadline dates with time evidence", () => {
  const dates = parseImportantDates("Başvurular 30 Eylül 2026 saat 17.00’ye kadar alınacaktır.");
  assert.equal(dates[0].type, "FULL_APPLICATION_DEADLINE");
  assert.equal(dates[0].date, "2026-09-30");
  assert.equal(dates[0].time, "17:00");

  const isoDates = parseImportantDates("Deadline: 2026-06-30");
  assert.equal(isoDates[0].date, "2026-06-30");
});

test("computes status from dates and extension/cancellation text", () => {
  assert.equal(computeStatus({ title: "Çağrı", deadline: "2099-07-01T00:00:00.000Z" }), "OPEN");
  assert.equal(computeStatus({ title: "Başvuru süresi uzatılmıştır", deadline: "2099-07-01T00:00:00.000Z" }), "EXTENDED");
  assert.equal(computeStatus({ title: "Çağrı iptal edilmiştir" }), "CANCELLED");
});

test("classifies result announcements separately from calls", () => {
  const result = classifyPageType({ title: "Proje Ön Değerlendirme Raporu Sonuçları Açıklandı" });
  assert.equal(result.pageType, "RESULT_ANNOUNCEMENT");
});

test("hash generation is stable and duplicate detector uses call code", () => {
  assert.equal(contentHash(" A  B "), contentHash("A B"));
  const { calls, duplicates } = dedupeAndFlag([
    { id: "a", sourceId: "tubitak", callCode: "ABC-2026", title: "Çağrı A" },
    { id: "b", sourceId: "tubitak", callCode: "ABC-2026", title: "Çağrı A tekrar" },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(duplicates.length, 1);
});

test("normalizes legacy call without breaking core fields", () => {
  const call = normalizeCallRecord({
    id: "sample",
    title: "Açık Çağrı",
    funder: "TÜBİTAK",
    source: "TÜBİTAK Duyurular",
    url: "https://tubitak.gov.tr/tr/duyuru/sample",
    deadline: "2099-07-01T00:00:00.000Z",
    summary: "Son başvuru 01.07.2099",
    status: "open",
  });
  assert.equal(call.id, "sample");
  assert.equal(call.sourceId, "tubitak");
  assert.equal(call.status, "open");
  assert.equal(call.normalizedStatus, "OPEN");
  assert.ok(call.confidenceScore >= 75);
  assert.ok(call.evidence.deadline);
});

test("matches official funding source and auto publishes verified calls", () => {
  const matched = matchFundingSource({
    title: "Horizon Europe çağrısı",
    summary: "European Commission call for proposals under Horizon Europe.",
    url: "https://commission.europa.eu/funding/call-123",
    applicationUrl: "https://funding-tenders.ec.europa.eu/opportunities/portal/screen/opportunities/topic-details/HORIZON-ABC",
  });
  assert.equal(matched.fundingSource.id, "eu_commission");
  assert.ok(matched.score >= 80);

  const call = normalizeCallRecord({
    title: "Horizon Europe call for proposals",
    summary: "Call for proposals under Horizon Europe with submission deadline 2030-06-01",
    url: "https://commission.europa.eu/funding/call-123",
    applicationUrl: "https://funding-tenders.ec.europa.eu/opportunities/portal/screen/opportunities/topic-details/HORIZON-ABC",
    deadline: "2030-06-01T00:00:00.000Z",
    status: "open",
  }, {
    source: { id: "eu-test", sourceType: "official", timezone: "Europe/Brussels", language: "en", country: "EU" },
  });
  assert.equal(call.reviewStatus, "approved");
  assert.equal(call.isPublished, true);
});

test("keeps third party discovery in manual review until official verification exists", () => {
  const call = normalizeCallRecord({
    title: "European Commission Horizon Europe open calls bulletin",
    summary: "Euresearch lists European Commission call for proposals under Horizon Europe with submission deadline.",
    url: "https://www.euresearch.ch/en/open-calls",
    deadline: "2030-06-01T00:00:00.000Z",
    status: "open",
  }, {
    source: { id: "euresearch", sourceType: "secondary", timezone: "Europe/Zurich", language: "en", country: "CH" },
  });
  assert.equal(call.reviewStatus, "manual_review");
  assert.equal(call.isPublished, false);
});

test("dedupe uses content hash and keeps higher confidence record", () => {
  const { calls, duplicates } = dedupeAndFlag([
    {
      id: "a",
      sourceId: "eu",
      title: "Call A",
      contentHash: "same",
      confidenceScore: 62,
      officialUrl: "https://example.com/a",
    },
    {
      id: "b",
      sourceId: "eu",
      title: "Call A updated",
      contentHash: "same",
      confidenceScore: 91,
      officialUrl: "https://example.com/b",
    },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(calls[0].id, "b");
});

test("blocks unsafe crawler URLs", () => {
  assert.equal(isSafeCrawlerUrl("https://example.com/call"), true);
  assert.equal(isSafeCrawlerUrl("file:///etc/passwd"), false);
  assert.equal(isSafeCrawlerUrl("http://127.0.0.1:3000"), false);
});
