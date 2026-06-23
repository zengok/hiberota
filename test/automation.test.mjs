import test from "node:test";
import assert from "node:assert/strict";
import {
  AutomationQueue,
  FUNDING_INSTITUTIONS,
  SOURCE_HEALTH_STATUSES,
  SOURCE_REGISTRY,
  SOURCE_VERIFICATION_STATUSES,
  buildLinkCheckCandidates,
  classifyPageType,
  computeStatus,
  contentHash,
  createSourceAdapters,
  dedupeAndFlag,
  extractFundingDetails,
  isSafeCrawlerUrl,
  mapWithConcurrency,
  mergeManualReviewQueue,
  matchFundingSource,
  normalizeCallRecord,
  parseImportantDates,
  updateSourceHealth,
} from "../server/automation.mjs";
import { createKosgebScraper, createTkdkScraper, createTurkiyeUlusalAjansiScraper } from "../server/scrapers/turkishOfficial.mjs";

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

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
  assert.equal(computeStatus({ title: "Başvuru takvimi güncellenerek ileri bir tarihe alınmıştır" }), "EXTENDED");
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

test("extracts grant amount and support rate from Turkish funding text", () => {
  const details = extractFundingDetails("Program kapsamında azami destek bütçesi 1.500.000 TL olup destek oranı %75 olarak uygulanır.");
  assert.equal(details.budgetMax, 1500000);
  assert.equal(details.currency, "TRY");
  assert.equal(details.supportRate, 75);
});

test("normalization fills budget fields from support and description text", () => {
  const call = normalizeCallRecord({
    title: "KOBİ Ar-Ge çağrısı",
    funder: "TÜBİTAK",
    source: "TÜBİTAK Duyurular",
    url: "https://tubitak.gov.tr/tr/duyuru/kobi-arge",
    summary: "Son başvuru 01.07.2099",
    description: "Çağrı için hibe miktarı en fazla 2 milyon TL, destek oranı yüzde 60 olarak belirlenmiştir.",
    support: "Resmî çağrı metninde belirtilir",
    deadline: "2099-07-01T00:00:00.000Z",
    status: "open",
  });

  assert.equal(call.budgetMax, 2000000);
  assert.equal(call.currency, "TRY");
  assert.equal(call.supportRate, 60);
  assert.match(call.support, /2\.000\.000 TL/);
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

test("manual review queue drops stale pending items and preserves resolved decisions", () => {
  const merged = mergeManualReviewQueue(
    [
      { id: "review-stale", status: "pending", title: "Old item", reasons: ["LOW_CONFIDENCE"] },
      { id: "review-current", status: "approve", title: "Current item", note: "accepted", reasons: ["LOW_CONFIDENCE"] },
    ],
    [
      { id: "review-current", status: "pending", title: "Current item updated", reasons: ["MISSING_DEADLINE"] },
      { id: "review-new", status: "pending", title: "New item", reasons: ["LOW_CONFIDENCE"] },
    ],
  );

  assert.equal(merged.some((item) => item.id === "review-stale"), false);
  assert.equal(merged.find((item) => item.id === "review-current").status, "approve");
  assert.deepEqual(merged.find((item) => item.id === "review-current").reasons, ["MISSING_DEADLINE"]);
  assert.equal(merged.find((item) => item.id === "review-new").status, "pending");
});

test("automation queue restores pending, running, and processed job snapshots", () => {
  const queue = new AutomationQueue({ concurrency: 1 });
  queue.enqueue({ type: "FETCH_LIST_PAGE", sourceId: "tubitak", url: "https://tubitak.gov.tr/tr/duyuru" });
  const running = queue.takeReady();
  queue.enqueue({ type: "VERIFY_LINKS", url: "https://example.com/call", priority: 9 });
  queue.complete(running, { count: 1 });

  const restored = new AutomationQueue({ concurrency: 1 });
  restored.restore(queue.persistableSnapshot());
  const snapshot = restored.snapshot();

  assert.equal(snapshot.processed.length, 1);
  assert.equal(snapshot.pendingJobs.length, 1);
  assert.equal(snapshot.pendingJobs[0].type, "VERIFY_LINKS");
});

test("link check candidates are safe, deduped, and limit-aware", () => {
  const candidates = buildLinkCheckCandidates([
    {
      id: "a",
      url: "https://example.com/a",
      officialUrl: "https://example.com/a",
      applicationUrl: "http://127.0.0.1/internal",
      guideUrl: "https://example.com/guide.pdf",
    },
  ], { limit: 5 });

  assert.deepEqual(candidates.map((item) => item.type), ["official", "guide"]);
});

test("PDF-directed source registry separates sources from institutions", () => {
  for (const id of ["kosgeb", "tkdk", "turkiye-ulusal-ajansi", "ka-development-agencies"]) {
    const source = SOURCE_REGISTRY.find((item) => item.id === id);
    assert.ok(source, `${id} source is registered`);
    assert.ok(source.allowedDomains.length > 0);
    assert.ok(source.institutionId);
    assert.ok(source.sourceGroup);
  }

  const developmentAgencies = FUNDING_INSTITUTIONS.filter((item) => item.institutionType === "development-agency");
  assert.equal(developmentAgencies.length, 26);
});

test("source health only becomes healthy after verified repeated successful crawls", () => {
  const source = SOURCE_REGISTRY.find((item) => item.id === "kosgeb");
  const state = { sources: { [source.id]: { ...source, successfulCrawlCount: 0 } }, sourceCrawlLogs: [] };
  updateSourceHealth(state, source, { ok: true, found: 1, durationMs: 10 });
  assert.equal(state.sources.kosgeb.healthStatus, SOURCE_HEALTH_STATUSES.DEGRADED);
  updateSourceHealth(state, source, { ok: true, found: 1, durationMs: 10 });
  assert.equal(state.sources.kosgeb.verificationStatus, SOURCE_VERIFICATION_STATUSES.VERIFIED);
  assert.equal(state.sources.kosgeb.healthStatus, SOURCE_HEALTH_STATUSES.HEALTHY);
});

test("new Turkish official scrapers extract application calls from fixture html", async () => {
  const kosgeb = createKosgebScraper();
  const kosgebItems = await kosgeb.extractListItems({
    url: "https://www.kosgeb.gov.tr/",
    html: `<article><a href="/site/tr/genel/detay/9374/girisimci-destek-programi-is-gelistirme-cagrisi-2026-yili-2-donem-basvurulari-basladi">Girişimci Destek Programı İş Geliştirme Çağrısı 2026 Yılı 2. Dönem Başvuruları Başladı</a><p>Başvurular 20 Nisan - 8 Mayıs 2026 tarihleri arasında alınacak. 2 milyon TL destek.</p></article>`,
  });
  assert.equal(kosgebItems[0].funder, "KOSGEB");
  assert.equal(kosgebItems[0].deadline, "2026-05-08T00:00:00.000Z");

  const tkdk = createTkdkScraper();
  const tkdkItems = await tkdk.extractListItems({
    url: "https://www.tkdk.gov.tr/ProjeIslemleri/CagriIlanArsiv",
    html: `<table><tr><td><a href="/Content/File/BasvuruFiles/CagriIlani.pdf">IPARD III 11.Başvuru Çağrı İlanı</a></td></tr><tr><td><a href="/duyuru/sonuclar">Başvuru Sonuçları Açıklandı</a></td></tr></table>`,
  });
  assert.equal(tkdkItems.length, 1);
  assert.match(tkdkItems[0].programme, /IPARD/);

  const ua = createTurkiyeUlusalAjansiScraper();
  const uaItems = await ua.extractListItems({
    url: "https://www.ua.gov.tr/anasayfa/icerikler/teklif-cagrilari-ve-rehberler/",
    html: `<main><ul><li><a href="/anasayfa/icerikler/teklif-cagrilari-ve-rehberler/">2026 Erasmus+ Programı Teklif Çağrıları ve Rehberler</a> Erasmus+ hibe programı başvuruları için teklif çağrısı yayımlandı.</li></ul></main>`,
  });
  assert.equal(uaItems.length, 1);
  assert.equal(uaItems[0].funder, "Türkiye Ulusal Ajansı");
});

test("mapWithConcurrency preserves result order", async () => {
  const values = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
    await new Promise((resolve) => setTimeout(resolve, value));
    return value * 10;
  });

  assert.deepEqual(values, [30, 10, 20]);
});

test("source adapters skip secondary detail scraping by default", async () => {
  const previous = process.env.ENABLE_SECONDARY_DEEP_SCRAPING;
  delete process.env.ENABLE_SECONDARY_DEEP_SCRAPING;
  let detailFetches = 0;
  const [adapter] = createSourceAdapters({
    "hibeportali-cascade": {
      discover: async () => ["https://example.com/page-1", "https://example.com/page-2"],
      fetchListPage: async (url) => ({ url }),
      extractListItems: async (page) => [
        { id: "same", title: "Same call", deadline: "2099-01-01T00:00:00.000Z", url: `${page.url}/same` },
      ],
      fetchDetailPage: async (item) => {
        detailFetches += 1;
        return { url: item.url };
      },
      extractDetailData: async () => ({ description: "detail" }),
    },
  }).filter((item) => item.id === "hibeportali-cascade");

  const items = await adapter.extractStructuredData();
  restoreEnv("ENABLE_SECONDARY_DEEP_SCRAPING", previous);

  assert.equal(items.length, 1);
  assert.equal(detailFetches, 0);
  assert.equal(items[0].description, undefined);
});

test("source adapters can opt in to secondary detail scraping", async () => {
  const previous = process.env.ENABLE_SECONDARY_DEEP_SCRAPING;
  process.env.ENABLE_SECONDARY_DEEP_SCRAPING = "true";
  let detailFetches = 0;
  const [adapter] = createSourceAdapters({
    "hibeportali-cascade": {
      discover: async () => ["https://example.com/page-1"],
      fetchListPage: async (url) => ({ url }),
      extractListItems: async () => [
        { id: "call-a", title: "Call A", deadline: "2099-01-01T00:00:00.000Z", url: "https://example.com/a" },
      ],
      fetchDetailPage: async (item) => {
        detailFetches += 1;
        return { url: item.url };
      },
      extractDetailData: async () => ({ description: "detail" }),
    },
  }).filter((item) => item.id === "hibeportali-cascade");

  const items = await adapter.extractStructuredData();
  restoreEnv("ENABLE_SECONDARY_DEEP_SCRAPING", previous);

  assert.equal(detailFetches, 1);
  assert.equal(items[0].description, "detail");
});
