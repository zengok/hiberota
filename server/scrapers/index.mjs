import { createEurekaScraper } from "./eureka.mjs";
import { createEuresearchScraper, createEuroAccessScraper } from "./genericEurope.mjs";
import { createGlobalDiscoveryScrapers } from "./globalDiscovery.mjs";
import { createGrantsGovScraper } from "./grantsGov.mjs";
import { createHibePortaliScraper } from "./hibePortali.mjs";
import { createTubitakScraper } from "./tubitak.mjs";
import { createTusebScraper } from "./tuseb.mjs";
import { createUfukAvrupaScraper } from "./ufukAvrupa.mjs";
import { createKosgebScraper, createTkdkScraper, createTurkiyeUlusalAjansiScraper } from "./turkishOfficial.mjs";

export function createScraperStrategies() {
  return {
    tubitak: createTubitakScraper(),
    "ufuk-avrupa": createUfukAvrupaScraper(),
    eureka: createEurekaScraper(),
    euresearch: createEuresearchScraper(),
    euroaccess: createEuroAccessScraper(),
    "hibeportali-cascade": createHibePortaliScraper(),
    "grants-gov": createGrantsGovScraper(),
    tuseb: createTusebScraper(),
    kosgeb: createKosgebScraper(),
    tkdk: createTkdkScraper(),
    "turkiye-ulusal-ajansi": createTurkiyeUlusalAjansiScraper(),
    ...createGlobalDiscoveryScrapers(),
  };
}
