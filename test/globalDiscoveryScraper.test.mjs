import test from "node:test";
import assert from "node:assert/strict";
import { createGlobalDiscoveryScraper } from "../server/scrapers/globalDiscovery.mjs";

test("global discovery scraper extracts funding links from official source pages", async () => {
  const source = {
    id: "sample-funder",
    name: "Sample Research Funder",
    baseUrl: "https://funding.example.org",
    listUrls: ["https://funding.example.org/opportunities"],
    sourceType: "official",
    country: "GB",
    language: "en",
    config: { keywords: ["research challenge"] },
  };
  const scraper = createGlobalDiscoveryScraper(source);
  const items = await scraper.extractListItems({
    url: source.listUrls[0],
    html: `
      <main>
        <article>
          <a href="/opportunities/research-challenge-2026">Research challenge grant for clean energy</a>
          <p>Funding opportunity. Application deadline 30 September 2026. Up to EUR 2 million.</p>
        </article>
        <article>
          <a href="/news/winners">Award winners announced</a>
        </article>
      </main>
    `,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].sourceId, "sample-funder");
  assert.equal(items[0].deadline, "2026-09-30T00:00:00.000Z");
  assert.equal(items[0].officialUrl, "https://funding.example.org/opportunities/research-challenge-2026");
  assert.match(items[0].support, /EUR/);
});
