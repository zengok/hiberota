import { createEurekaScraper } from "./eureka.mjs";
import { createEuresearchScraper, createEuroAccessScraper } from "./genericEurope.mjs";
import { createGrantsGovScraper } from "./grantsGov.mjs";
import { createGlobalDiscoveryScrapers } from "./globalDiscovery.mjs";
import { createTubitakScraper } from "./tubitak.mjs";
import { createTusebScraper } from "./tuseb.mjs";
import { createUfukAvrupaScraper } from "./ufukAvrupa.mjs";

export function createScraperStrategies() {
  return {
    tubitak: createTubitakScraper(),
    "ufuk-avrupa": createUfukAvrupaScraper(),
    eureka: createEurekaScraper(),
    euresearch: createEuresearchScraper(),
    euroaccess: createEuroAccessScraper(),
    "grants-gov": createGrantsGovScraper(),
    tuseb: createTusebScraper(),
    ...createGlobalDiscoveryScrapers(),
  };
}
