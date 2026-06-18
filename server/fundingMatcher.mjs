export const GLOBAL_FUNDING_DATABASE = [
  {
    id: "tubitak",
    name: "TÜBİTAK (The Scientific and Technological Research Council of Türkiye)",
    region_country: "Turkey",
    type: "National Agency",
    website: "https://tubitak.gov.tr/en",
    target_audiences: ["Undergraduate Students", "Graduate Students", "Postdocs", "Academics", "Industry Researchers"],
    example_programs: [
      "2209-A Research Project Support Programme for Undergraduate Students",
      "2209-B Undergraduate Research Project Support Programme for Industry",
      "1001 - Scientific and Technological Research Projects Funding Program",
      "2232 - International Fellowship for Outstanding Researchers",
    ],
  },
  {
    id: "horizon_europe",
    name: "Horizon Europe (European Commission)",
    region_country: "European Union",
    type: "International Union / Federation",
    website: "https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe_en",
    target_audiences: ["Graduate Students", "Postdocs", "Academics", "Institutions", "SMEs"],
    example_programs: [
      "ERC (European Research Council) Grants (Starting, Consolidator, Advanced)",
      "MSCA (Marie Skłodowska-Curie Actions) Fellowships",
      "EIC (European Innovation Council) Pathfinder",
    ],
  },
  {
    id: "nsf",
    name: "National Science Foundation (NSF)",
    region_country: "United States",
    type: "National Agency",
    website: "https://new.nsf.gov/funding",
    target_audiences: ["Undergraduate Students", "Graduate Students", "Postdocs", "Academics", "Institutions"],
    example_programs: [
      "REU (Research Experiences for Undergraduates)",
      "NSF CAREER Awards (for early-career faculty)",
      "Graduate Research Fellowship Program (GRFP)",
    ],
  },
  {
    id: "nih",
    name: "National Institutes of Health (NIH)",
    region_country: "United States",
    type: "National Agency",
    website: "https://grants.nih.gov/funding/index.htm",
    target_audiences: ["Undergraduate Students", "Graduate Students", "Postdocs", "Academics", "Doctors / Clinical Researchers"],
    example_programs: [
      "R01 Research Project Grant",
      "K Series (Career Development Awards)",
      "F Series (Fellowship Programs for Predoctoral and Postdoctoral Students)",
    ],
  },
  {
    id: "dfg",
    name: "German Research Foundation (DFG)",
    region_country: "Germany",
    type: "National Agency",
    website: "https://www.dfg.de/en/research_funding/index.html",
    target_audiences: ["Graduate Students", "Postdocs", "Academics"],
    example_programs: ["Individual Research Grants", "Walter Benjamin Programme (Postdoc)", "Emmy Noether Programme (Early career researchers)"],
  },
  {
    id: "daad",
    name: "German Academic Exchange Service (DAAD)",
    region_country: "Germany (Global reach)",
    type: "Association / Agency",
    website: "https://www.daad.de/en/study-and-research-in-germany/scholarships/",
    target_audiences: ["Undergraduate Students", "Graduate Students", "Postdocs", "Academics"],
    example_programs: ["Research Grants - Short-Term Grants", "Research Grants - Doctoral Programmes in Germany", "Bilateral Exchange of Academics"],
  },
  {
    id: "ukri",
    name: "UK Research and Innovation (UKRI)",
    region_country: "United Kingdom",
    type: "National Agency",
    website: "https://www.ukri.org/opportunity/",
    target_audiences: ["Graduate Students", "Postdocs", "Academics", "Institutions"],
    example_programs: ["Future Leaders Fellowships", "Research Council Standard Grants (e.g., EPSRC, MRC)", "Global Challenges Research Fund (GCRF)"],
  },
  {
    id: "wellcome",
    name: "Wellcome Trust",
    region_country: "United Kingdom (Global reach)",
    type: "Private Foundation / Trust",
    website: "https://wellcome.org/grant-funding",
    target_audiences: ["Postdocs", "Academics", "Doctors", "Institutions"],
    example_programs: ["Early-Career Awards", "Career Development Awards", "Discovery Awards"],
  },
  {
    id: "jsps",
    name: "Japan Society for the Promotion of Science (JSPS)",
    region_country: "Japan",
    type: "National Agency",
    website: "https://www.jsps.go.jp/english/",
    target_audiences: ["Graduate Students", "Postdocs", "Academics"],
    example_programs: ["Postdoctoral Fellowships for Research in Japan", "Invitational Fellowships for Research in Japan", "Grants-in-Aid for Scientific Research (KAKENHI)"],
  },
  {
    id: "arc",
    name: "Australian Research Council (ARC)",
    region_country: "Australia",
    type: "National Agency",
    website: "https://www.arc.gov.au/funding-research",
    target_audiences: ["Postdocs", "Academics"],
    example_programs: ["Discovery Early Career Researcher Award (DECRA)", "Discovery Projects", "Future Fellowships"],
  },
  {
    id: "nserc",
    name: "Natural Sciences and Engineering Research Council (NSERC)",
    region_country: "Canada",
    type: "National Agency",
    website: "https://www.nserc-crsng.gc.ca/index_eng.asp",
    target_audiences: ["Undergraduate Students", "Graduate Students", "Postdocs", "Academics"],
    example_programs: ["Undergraduate Student Research Awards (USRA)", "Discovery Grants", "Postdoctoral Fellowships"],
  },
  {
    id: "fulbright",
    name: "The Fulbright Program",
    region_country: "United States (Global reach)",
    type: "Government Program",
    website: "https://eca.state.gov/fulbright",
    target_audiences: ["Graduate Students", "Academics", "Professionals"],
    example_programs: ["Fulbright U.S. Student Program", "Fulbright Visiting Scholar Program", "Fulbright Foreign Student Program"],
  },
  {
    id: "euraxess",
    name: "EURAXESS",
    region_country: "European Union",
    type: "Database / Portal",
    website: "https://euraxess.ec.europa.eu/jobs/search",
    target_audiences: ["Undergraduate Students", "Graduate Students", "Postdocs", "Academics"],
    example_programs: ["Acts as a portal for thousands of European and global fellowship/grant listings"],
  },
  {
    id: "pivot_rp",
    name: "Pivot-RP",
    region_country: "Global",
    type: "Database / Aggregator",
    website: "https://pivot.proquest.com/",
    target_audiences: ["Graduate Students", "Postdocs", "Academics", "Institutions"],
    example_programs: ["Search engine for global grants, fellowships, and awards"],
  },
  {
    id: "grantforward",
    name: "GrantForward",
    region_country: "Global",
    type: "Database / Aggregator",
    website: "https://www.grantforward.com/",
    target_audiences: ["Graduate Students", "Postdocs", "Academics"],
    example_programs: ["AI-driven recommendation service that matches grants across 30,000+ sponsors"],
  },
];

function clean(value = "") {
  return String(value).toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeAcademicLevel(value = "") {
  const text = clean(value);
  if (!text) return "";
  if (/undergrad|undergraduate|bachelor|lisans/.test(text)) return "Undergraduate Students";
  if (/master|msc|graduate|yüksek lisans|yuksek lisans|phd|doctor|doctoral|doktora/.test(text)) return "Graduate Students";
  if (/postdoc|post doctoral|postdoctoral|doktora sonrasi|doktora sonrası/.test(text)) return "Postdocs";
  if (/professor|academic|faculty|akademisyen|öğretim|ogretim/.test(text)) return "Academics";
  if (/doctor|clinical|clinician|hekim/.test(text)) return "Doctors / Clinical Researchers";
  if (/institution|university|kurum/.test(text)) return "Institutions";
  if (/sme|kobi|startup|company|industry|sanayi/.test(text)) return "SMEs";
  return value;
}

function regionScore(entity, targetDestination = "", location = "") {
  const target = clean(`${targetDestination} ${location}`);
  const region = clean(entity.region_country);
  if (!target) return entity.region_country === "Global" || /global reach/i.test(entity.region_country) ? 6 : 0;
  if (target.includes("global") || target.includes("worldwide")) return entity.region_country === "Global" || /global reach/i.test(entity.region_country) ? 18 : 4;
  if (target.includes("europe") || target.includes("eu")) return /europe|european union|germany|united kingdom/i.test(entity.region_country) ? 18 : 0;
  if (target.includes("turkey") || target.includes("turkiye") || target.includes("türkiye")) return /turkey/i.test(entity.region_country) ? 18 : 0;
  if (target.includes("united states") || target.includes("usa") || target.includes("us")) return /united states/i.test(entity.region_country) ? 18 : 0;
  if (target.includes("germany")) return /germany/i.test(entity.region_country) ? 18 : 0;
  if (target.includes("canada")) return /canada/i.test(entity.region_country) ? 18 : 0;
  if (target.includes("japan")) return /japan/i.test(entity.region_country) ? 18 : 0;
  if (target.includes("australia")) return /australia/i.test(entity.region_country) ? 18 : 0;
  if (target.includes("united kingdom") || target.includes("uk")) return /united kingdom/i.test(entity.region_country) ? 18 : 0;
  return region && target.includes(region) ? 18 : 0;
}

function fieldScore(entity, researchField = "") {
  const field = clean(researchField);
  if (!field) return 0;
  if (/health|medical|medicine|clinical|biomed|life science/.test(field) && /nih|wellcome/i.test(entity.id)) return 10;
  if (/engineering|science|technology|computer|physics|chemistry|math/.test(field) && /nsf|nserc|tubitak|horizon_europe/i.test(entity.id)) return 8;
  if (/europe|mobility|career|fellowship/.test(field) && /horizon_europe|daad|euraxess/i.test(entity.id)) return 6;
  return 0;
}

function isAggregator(entity) {
  return /Database|Aggregator|Portal/i.test(entity.type);
}

export function matchGlobalFundingDatabase(profile = {}) {
  const academicLevel = normalizeAcademicLevel(profile.academicLevel || profile.level || profile.currentAcademicLevel || "");
  const researchField = profile.researchField || profile.field || "";
  const targetDestination = profile.targetDestination || profile.destination || profile.country || "";
  const location = profile.location || profile.currentLocation || "";
  const wantsGlobalSearch = /global|worldwide|comprehensive|all/i.test(`${profile.searchScope || ""} ${targetDestination}`);
  const clarificationQuestions = [];
  if (!academicLevel) clarificationQuestions.push("What is your current academic level?");
  if (!targetDestination && !location && !wantsGlobalSearch) clarificationQuestions.push("Which country or region do you want to target?");

  const matches = GLOBAL_FUNDING_DATABASE
    .map((entity) => {
      const audienceMatch = academicLevel ? entity.target_audiences.includes(academicLevel) : false;
      if (academicLevel && !audienceMatch) return null;
      const score =
        (audienceMatch ? 55 : 0) +
        regionScore(entity, targetDestination, location) +
        fieldScore(entity, researchField) +
        (wantsGlobalSearch && isAggregator(entity) ? 20 : 0) +
        (isAggregator(entity) ? 3 : 0);
      return {
        id: entity.id,
        name: entity.name,
        region_country: entity.region_country,
        type: entity.type,
        website: entity.website,
        target_audiences: entity.target_audiences,
        example_programs: entity.example_programs,
        match_score: Math.min(100, score),
        match_reasons: [
          ...(audienceMatch ? [`Audience match: ${academicLevel}`] : []),
          ...(regionScore(entity, targetDestination, location) ? [`Region match: ${entity.region_country}`] : []),
          ...(fieldScore(entity, researchField) ? [`Field signal: ${researchField}`] : []),
          ...(wantsGlobalSearch && isAggregator(entity) ? ["Global aggregator/database suitable for broad search"] : []),
        ],
        next_step: `Check the official portal for open calls and deadlines: ${entity.website}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.match_score - a.match_score || a.name.localeCompare(b.name))
    .slice(0, 8);

  return {
    profile: {
      academicLevel: academicLevel || null,
      researchField: researchField || null,
      targetDestination: targetDestination || null,
      location: location || null,
    },
    needsClarification: clarificationQuestions.length > 0,
    clarificationQuestions,
    matches,
  };
}
