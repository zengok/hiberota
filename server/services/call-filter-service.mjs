function normalizeWhitespace(value = "") {
  return String(value).replace(/<[a-z/][^>]*>/gi, " ").replace(/\s+/g, " ").trim();
}

const keywordPatterns = [
  {
    value: "digital-ai",
    terms: ["yapay zeka", "artificial intelligence", "machine learning", "makine öğrenmesi", "digital", "dijital", "data", "veri", "security", "cyber", "siber", "network", "software", "technology", "technologies"],
  },
  {
    value: "health-clinical",
    terms: ["sağlık", "saglik", "health", "clinical", "klinik", "medical", "biomedical", "biyomedikal", "biomarker", "biyobelirteç", "biotechnology", "biyoteknoloji", "patient", "hastane"],
  },
  {
    value: "energy-climate",
    terms: ["enerji", "energy", "climate", "iklim", "green", "yeşil", "sustainability", "sürdürülebilir", "environment", "çevre", "carbon", "karbon", "clean", "temiz"],
  },
  {
    value: "sme-innovation",
    terms: ["kobi", "sme", "startup", "girişim", "girisim", "company", "şirket", "sirket", "innovation", "inovasyon", "commercial", "ticarileşme", "yatırım", "investment"],
  },
  {
    value: "agriculture-food",
    terms: ["tarım", "tarim", "agriculture", "food", "gıda", "gida", "rural", "kırsal", "kirsal", "farmer", "çiftçi", "ciftci", "cooperative", "kooperatif"],
  },
  {
    value: "education-youth",
    terms: ["eğitim", "egitim", "education", "school", "okul", "student", "öğrenci", "ogrenci", "youth", "genç", "genc", "children", "çocuk", "cocuk", "violence", "şiddet", "siddet", "suicide", "intihar", "social", "sosyal"],
  },
  {
    value: "public-civil",
    terms: ["kamu", "public", "belediye", "municipality", "stk", "ngo", "nonprofit", "dernek", "vakıf", "vakif", "local", "yerel", "civil", "civic"],
  },
  {
    value: "research-partnership",
    terms: ["akadem", "üniversite", "universite", "university", "researcher", "araştırmacı", "arastirmaci", "partnership", "ortaklık", "ortaklik", "consortium", "konsorsiyum", "doctoral", "doktora", "postdoc"],
  },
];

export function scopeFromParam(value) {
  const map = {
    national: "Ulusal",
    ulusal: "Ulusal",
    turkey: "Ulusal",
    turkiye: "Ulusal",
    türkiye: "Ulusal",
    europe: "Avrupa",
    avrupa: "Avrupa",
    eu: "Avrupa",
    international: "Yurtdışı",
    uluslararasi: "Yurtdışı",
    uluslararası: "Yurtdışı",
    global: "Yurtdışı",
  };
  return map[String(value || "").toLocaleLowerCase("tr-TR")] || value;
}

export function normalizeSearchText(value = "") {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function callSearchText(call) {
  return normalizeSearchText(
    [
      call.title,
      call.funder,
      call.institution,
      call.category,
      call.programme,
      call.thematicArea,
      call.supportType,
      call.support,
      call.categories?.join(" "),
      call.summary,
      call.source,
      call.scope,
      call.externalId,
      call.callCode,
      call.targetAudience?.join(" "),
      call.eligibleCountries?.join(" "),
      call.eligibleInstitutions?.join(" "),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function keywordPatternMatches(call, value) {
  const pattern = keywordPatterns.find((item) => item.value === value);
  if (!pattern) return null;
  const haystack = callSearchText(call);
  return pattern.terms.some((term) => {
    const terms = normalizeSearchText(term).split(" ").filter(Boolean);
    return terms.length > 0 && terms.every((token) => haystack.includes(token));
  });
}

export function statusGroup(call) {
  const normalized = call.normalizedStatus || "";
  if (["OPEN", "CLOSING_SOON", "EXTENDED"].includes(normalized)) return "open";
  if (["UPCOMING", "ANNOUNCED"].includes(normalized)) return "upcoming";
  if (["CLOSED", "ARCHIVED", "CANCELLED", "RESULT_PUBLISHED"].includes(normalized)) return "closed";
  return call.status || "upcoming";
}

export function categoryMatches(call, category) {
  if (!category) return true;
  return call.category === category || call.programme === category || (call.categories || []).includes(category);
}

export function targetGroupsForCall(call) {
  const explicit = Array.isArray(call.targetAudience) ? call.targetAudience : call.targetAudience ? [call.targetAudience] : [];
  if (explicit.length) return explicit;
  const text = normalizeSearchText([
    call.title,
    call.summary,
    call.category,
    call.programme,
    call.supportType,
    ...(call.eligibleInstitutions || []),
  ].filter(Boolean).join(" "));
  const groups = [];
  if (/(ogrenci|student|doctoral|doktora)/.test(text)) groups.push("Öğrenciler ve doktora araştırmacıları");
  if (/(akadem|universite|university|researcher|arastirmac)/.test(text)) groups.push("Akademisyenler ve araştırmacılar");
  if (/(kobi|sme|firma|sirket|company|startup|girisim)/.test(text)) groups.push("KOBİ'ler, girişimler ve şirketler");
  if (/(kamu|belediye|public)/.test(text)) groups.push("Kamu kurumları ve yerel yönetimler");
  if (/(ngo|stk|dernek|vakif|nonprofit)/.test(text)) groups.push("STK'lar ve sosyal girişimler");
  return groups.length ? groups : ["Çağrı koşullarına uygun başvuru sahipleri"];
}

export function dateMs(value) {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

export function daysUntil(value, now = Date.now()) {
  if (!value) return null;
  const lastMoment = new Date(value);
  lastMoment.setHours(23, 59, 59, 999);
  return Math.ceil((lastMoment.getTime() - now) / 86400000);
}

function booleanParam(value) {
  if (value === true) return true;
  return ["1", "true", "yes", "evet"].includes(String(value || "").toLocaleLowerCase("tr-TR"));
}

function isOfficialCall(call) {
  if (call.isOfficial === true || call.sourceType === "official") return true;
  if (call.officialUrl && call.url && call.officialUrl === call.url) return true;
  return call.reviewStatus === "approved" && call.confidenceScore >= 80;
}

export function filterCalls(calls, query = {}, options = {}) {
  const searchTerms = normalizeSearchText(query.q || query.search || query.query || "").split(" ").filter(Boolean);
  const keyword = normalizeWhitespace(query.keyword || query.keywords || "");
  const keywordTerms = normalizeSearchText(keyword).split(" ").filter(Boolean);
  const scope = scopeFromParam(query.scope);
  const status = query.status || "open";
  const deadlineWithin = query.deadlineWithin ? Number(query.deadlineWithin) : null;
  const category = normalizeWhitespace(query.category || "");
  const funder = normalizeWhitespace(query.funder || "");
  const institution = normalizeWhitespace(query.institution || "");
  const program = normalizeWhitespace(query.program || "");
  const supportType = normalizeWhitespace(query.supportType || "");
  const targetGroup = normalizeSearchText(query.targetGroup || query.audience || "");
  const thematicArea = normalizeSearchText(query.thematicArea || query.theme || "");
  const country = normalizeWhitespace(query.country || "");
  const currency = normalizeWhitespace(query.currency || "");
  const deadlineFrom = query.deadlineFrom ? new Date(query.deadlineFrom).getTime() : null;
  const deadlineTo = query.deadlineTo ? new Date(query.deadlineTo).getTime() : null;
  const budgetMin = query.budgetMin ? Number(query.budgetMin) : null;
  const budgetMax = query.budgetMax ? Number(query.budgetMax) : null;
  const officialOnly = booleanParam(query.officialOnly);

  let result = calls.filter((call) => {
    const haystack = callSearchText(call);
    const keywordPatternMatch = keyword ? keywordPatternMatches(call, keyword) : null;
    const left = daysUntil(call.deadline, options.now);
    const deadlineMs = call.deadline ? new Date(call.deadline).getTime() : null;
    const callBudgetMin = Number(call.budgetMin ?? call.budgetMax ?? 0) || null;
    const callBudgetMax = Number(call.budgetMax ?? call.budgetMin ?? 0) || null;
    return (
      (!searchTerms.length || searchTerms.every((term) => haystack.includes(term))) &&
      (!keywordTerms.length || keywordPatternMatch === true || (keywordPatternMatch === null && keywordTerms.every((term) => haystack.includes(term)))) &&
      (!scope || scope === "Tümü" || call.scope === scope) &&
      (!status || status === "all" || statusGroup(call) === status) &&
      categoryMatches(call, category) &&
      (!funder || call.funder === funder) &&
      (!institution || call.institution === institution || call.funder === institution) &&
      (!program || call.programme === program || call.category === program) &&
      (!supportType || call.supportType === supportType || call.category === supportType) &&
      (!targetGroup || targetGroupsForCall(call).some((item) => normalizeSearchText(item).includes(targetGroup))) &&
      (!thematicArea || (call.categories || []).some((item) => normalizeSearchText(item).includes(thematicArea)) || haystack.includes(thematicArea)) &&
      (!country || call.country === country || (call.eligibleCountries || []).includes(country)) &&
      (!currency || call.currency === currency) &&
      (!deadlineFrom || (deadlineMs && deadlineMs >= deadlineFrom)) &&
      (!deadlineTo || (deadlineMs && deadlineMs <= deadlineTo)) &&
      (!budgetMin || (callBudgetMax && callBudgetMax >= budgetMin)) &&
      (!budgetMax || (callBudgetMin && callBudgetMin <= budgetMax)) &&
      (!officialOnly || isOfficialCall(call)) &&
      (!deadlineWithin || (left !== null && left >= 0 && left <= deadlineWithin))
    );
  });

  if (query.sort === "deadline_desc") result = result.sort((a, b) => dateMs(b.deadline) - dateMs(a.deadline));
  else if (query.sort === "newest") result = result.sort((a, b) => dateMs(b.publishedAt) - dateMs(a.publishedAt));
  else result = result.sort((a, b) => dateMs(a.deadline) - dateMs(b.deadline));

  return result;
}
