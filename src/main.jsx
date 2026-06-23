import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Clock3,
  Database,
  FileDown,
  FileText,
  Globe2,
  GraduationCap,
  Heart,
  Landmark,
  Languages,
  Leaf,
  ListFilter,
  Mail,
  MapPin,
  MessageCircle,
  Menu,
  RefreshCw,
  Rocket,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Star,
  Target,
  Timer,
  Users,
  WalletCards,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import catalogData from "./data/catalog.json";
import { FavoriteButton } from "./components/FavoriteButton.jsx";
import { useFavorites } from "./hooks/useFavorites.js";
import { CallCardSkeleton } from "./components/SkeletonLoading.jsx";
import { NewsletterCard } from "./components/subscriptions/NewsletterCard.jsx";
import "./styles.css";

const SITE_URL = "https://hiberota.com";
const SITE_NAME = "Hibe Rota";
const SITE_LOGO_URL = `${SITE_URL}/favicon.svg`;
const DEFAULT_SEO_TITLE = "Hibe Rota | Hibe, Fon ve Proje Destek Çağrıları";
const DEFAULT_SEO_DESCRIPTION =
  "Türkiye, Avrupa Birliği ve uluslararası hibe, fon, teşvik ve proje destek çağrılarını tek panelde takip edin; son başvuru tarihleri, kurumlar ve başvuru rehberi.";
const DEFAULT_SEO_KEYWORDS =
  "hibe, fon, proje destekleri, hibe çağrıları, fon çağrıları, TÜBİTAK destekleri, KOSGEB destekleri, Avrupa Birliği hibeleri, proje başvurusu, destek programları";

export function cleanHtml(text = "") {
  return String(text).replace(/<[a-z/][^>]*>/gi, " ").replace(/\s+/g, " ").trim();
}

export function ensureHttp(url) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `https://${url}`;
}

const filterTabs = [
  { label: "Türkiye", value: "Ulusal", query: "national", dot: "tr" },
  { label: "Avrupa Proje Destekleri", value: "Avrupa", query: "europe", dot: "eu" },
  { label: "Uluslararası", value: "Yurtdışı", query: "international", dot: "global" },
  { label: "Tümü", value: "Tümü", query: "all", dot: "all" },
];
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
function msUntilNextHour() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next.getTime() - now.getTime();
}
const routeLinks = [
  { href: "/", label: "Ana Sayfa" },
  {
    href: "/cagrilar",
    label: "Çağrılar",
    children: [
      { href: "/cagrilar", label: "Tüm Çağrılar" },
      { href: "/cagrilar/ulusal", label: "Ulusal Çağrılar" },
      { href: "/cagrilar/avrupa", label: "Avrupa Çağrıları" },
      { href: "/cagrilar/uluslararasi", label: "Uluslararası Çağrılar" },
      { href: "/cagrilar/yaklasan", label: "Yaklaşan Çağrılar" },
    ],
  },
  { href: "/hibe-anketi", label: "Hibe Anketi" },
  { href: "/programlar", label: "Destek Programları" },
  { href: "/kurumlar", label: "Kurumlar" },
  { href: "/takvim", label: "Çağrı Takvimi" },
  { href: "/rehber", label: "Proje Rehberi" },
  { href: "/hakkimizda", label: "Hakkımızda" },
  { href: "/iletisim", label: "İletişim" },
];
const audiences = [
  { label: "Öğrenci", query: "öğrenci", icon: GraduationCap },
  { label: "Akademisyen", query: "akademi", icon: BookOpen },
  { label: "Araştırmacı", query: "araştırma", icon: Search },
  { label: "Girişimci", query: "girişim", icon: Rocket },
  { label: "Firma", query: "KOBİ", icon: Building2 },
  { label: "Kurumsal", query: "kamu", icon: Landmark },
];
const SURVEY_SEEN_KEY = "hiberota:grant-survey-seen:v1";
const ADMIN_TOKEN_STORAGE_KEY = "hiberota:admin-session-token";
const surveyInitialState = {
  userType: "student",
  academicLevel: "Undergraduate Students",
  researchField: "",
  projectSummary: "",
  location: "Türkiye",
  targetDestination: "Turkey",
  searchScope: "Turkey",
  preferredScopes: ["national"],
  themes: [],
  budgetNeed: "",
  timing: "open",
};
const surveyUserTypes = [
  { value: "student", label: "Öğrenci", academicLevel: "Undergraduate Students", icon: GraduationCap },
  { value: "graduate", label: "Yüksek lisans / doktora", academicLevel: "Graduate Students", icon: BookOpen },
  { value: "academic", label: "Akademisyen", academicLevel: "Academics", icon: Landmark },
  { value: "researcher", label: "Araştırmacı", academicLevel: "Postdocs", icon: Search },
  { value: "company", label: "Şirket / KOBİ", academicLevel: "SMEs", icon: Building2 },
  { value: "institution", label: "Kurum", academicLevel: "Institutions", icon: Users },
];
const surveyFields = [
  "Sağlık ve yaşam bilimleri",
  "Yapay zeka ve dijital teknolojiler",
  "Enerji ve iklim",
  "Tarım ve gıda",
  "Sosyal bilimler",
  "Sanayi ve üretim",
  "Eğitim",
  "Kültür ve yaratıcı endüstriler",
];
const surveyScopes = [
  { value: "national", label: "Türkiye", destination: "Turkey" },
  { value: "europe", label: "Avrupa", destination: "Europe" },
  { value: "international", label: "Uluslararası", destination: "Global" },
];
const defaultCallFilters = {
  query: "",
  scope: "Tümü",
  status: "open",
  category: "",
  funder: "",
  targetGroup: "",
  keyword: "",
  thematicArea: "",
  country: "",
  currency: "",
  budgetMin: "",
  budgetMax: "",
  deadlineWithin: "",
  deadlineFrom: "",
  deadlineTo: "",
  officialOnly: false,
  sort: "deadline_asc",
};
const guideCards = [
  {
    slug: "etkili-proje-ozeti-nasil-yazilir",
    tag: "Proje Yazımı",
    time: "12 dk",
    title: "Etkili Bir Proje Özeti Nasıl Yazılır?",
    text: "Değerlendiricinin ilk baktığı alan olan proje özetini net amaç, özgün değer ve beklenen etkiyle yapılandırın.",
    sections: [
      {
        title: "Güçlü özetin amacı",
        body: "Proje özeti, değerlendiricinin çalışmanızla ilk temas ettiği alandır. Bu bölümde problem, önerilen çözüm, yöntem, beklenen çıktı ve etki aynı akış içinde kısa ama ikna edici şekilde görünmelidir.",
      },
      {
        title: "Özgün değer nasıl anlatılır?",
        body: "Özgün değeri yalnızca yeni bir fikir olarak yazmak yeterli değildir. Mevcut bilgi veya uygulamadaki boşluğu belirtin, projenizin bu boşluğu hangi yöntemle kapatacağını açıkça ifade edin.",
      },
      {
        title: "Kontrol listesi",
        body: "Özetinizde hedef, yöntem, iş paketleri, ölçülebilir çıktı, hedef kitle, yaygın etki ve başvurduğunuz çağrı ile uyum mutlaka yer almalıdır. Teknik ayrıntıyı artırmak yerine karar vericinin hızlı anlayacağı bir yapı kurun.",
      },
    ],
  },
  {
    slug: "tubitak-projelerinde-butce-kalemleri",
    tag: "Bütçe Hazırlama",
    time: "18 dk",
    title: "TÜBİTAK Projelerinde Bütçe Kalemleri",
    text: "Personel, seyahat, hizmet alımı ve sarf kalemlerini çağrı koşullarıyla uyumlu gerekçelendirin.",
    sections: [
      {
        title: "Bütçe mantığını kurmak",
        body: "Bütçe, yalnızca maliyet listesi değildir; projenin yöntemini ve uygulanabilirliğini destekleyen kanıttır. Her kalem doğrudan bir iş paketi, çıktı veya faaliyet ile ilişkilendirilmelidir.",
      },
      {
        title: "Kalemleri gerekçelendirme",
        body: "Personel ihtiyacında görev ve zaman katkısını, sarf malzemesinde deney veya üretim bağlantısını, hizmet alımında dış uzmanlık gerekçesini, seyahatte proje hedefiyle bağını açıkça yazın.",
      },
      {
        title: "Sık yapılan hatalar",
        body: "Yuvarlak maliyetler, çağrı üst limitlerini aşan planlama, faaliyetle ilişkisi belirsiz hizmet alımları ve yeterince açıklanmamış personel süreleri bütçe değerlendirmesinde zayıf görünür.",
      },
    ],
  },
  {
    slug: "cagri-metni-analizi",
    tag: "Çağrı Okuma",
    time: "8 dk",
    title: "Çağrı Metni Analizi: Satır Aralarını Okumak",
    text: "Fon sağlayıcının önceliklerini, beklenen çıktıları ve uygunluk sınırlarını hızlıca tespit edin.",
    sections: [
      {
        title: "Öncelikleri işaretleyin",
        body: "Çağrı metninde tekrar eden kavramlar, hedeflenen sektörler, beklenen çıktılar ve uygun başvuru sahipleri projenizin konumunu belirler. İlk okumada bu alanları işaretleyin.",
      },
      {
        title: "Uygunluk sınırlarını ayırın",
        body: "Başvuru sahibi türü, ortaklık şartı, bütçe üst limiti, proje süresi, teknoloji olgunluk seviyesi ve coğrafi kısıtlar fikirden önce kontrol edilmelidir.",
      },
      {
        title: "Çağrı dilini proje diline çevirin",
        body: "Başvuru metniniz çağrıdaki anahtar kelimeleri doğal biçimde yansıtmalıdır. Fakat bunu kopyalama gibi değil, projenizin hedefleriyle çağrı beklentisini eşleştirerek yapın.",
      },
    ],
  },
  {
    slug: "dogru-konsorsiyumu-kurma",
    tag: "Ortaklık",
    time: "15 dk",
    title: "Doğru Konsorsiyumu Kurma Stratejileri",
    text: "Uluslararası çağrılarda tamamlayıcı uzmanlıkları ve güçlü iş paketlerini bir araya getirin.",
    sections: [
      {
        title: "Rol dengesini kurun",
        body: "İyi bir konsorsiyumda her ortak net bir uzmanlık, iş paketi veya saha erişimi getirir. Benzer kurumların tekrarından kaçınarak tamamlayıcı yetenekleri bir araya getirin.",
      },
      {
        title: "Koordinasyon kapasitesi",
        body: "Uluslararası projelerde koordinatörün teknik liderlik kadar raporlama, bütçe yönetimi ve ortak iletişimi kapasitesi de önemlidir. Bu kapasite başvuruda görünür olmalıdır.",
      },
      {
        title: "Etki ve yaygınlaştırma",
        body: "Konsorsiyum sadece geliştirme ekibi değildir; sonuçların kullanımı, pilot uygulama, standardizasyon, pazar veya politika etkisi için doğru paydaşları içermelidir.",
      },
    ],
  },
];
const sectorChips = [
  { label: "Tarım", query: "Tarım", icon: Leaf },
  { label: "Bilişim", query: "Bilişim", icon: Database },
  { label: "Enerji", query: "Enerji", icon: Sparkles },
  { label: "Sağlık", query: "Sağlık", icon: Heart },
  { label: "İmalat", query: "İmalat", icon: Building2 },
  { label: "Akademi", query: "Akademi", icon: GraduationCap },
];

const defaultSiteContent = {
  images: {
    logoSvg: "/logo.svg",
    logoPng: "/logo.png",
    heroImage: "",
  },
  home: {
    heroTitle: "Projenize uygun destek çağrısını bulun",
    heroText: "Ulusal ve uluslararası binlerce hibe, fon ve destek programını tek noktadan keşfedin. İhtiyacınız olan finansmana en kısa yoldan ulaşın.",
    promoTitle: "Doğru hibeyi daha hızlı yakalayın.",
    promoText: "Canlı kaynaklar taranır, açık çağrılar tek listede toplanır ve kritik son tarihler öne çıkarılır.",
  },
  guide: {
    heroTitle: "Proje Başvuru Rehberi",
    heroText: "Araştırma ve yenilik projelerinizi başarıyla hazırlamak, bütçelendirmek ve yönetmek için kapsamlı bilgi merkezi.",
    categories: ["Tüm Kategoriler", "Çağrı Okuma", "Proje Yazımı", "Bütçe Hazırlama", "Ortaklık Kurma", "Değerlendirme Süreci"],
    glossary: [
      { term: "Ar-Ge", definition: "Bilgi dağarcığını artırmak için yürütülen sistematik yaratıcı çalışmalar." },
      { term: "TRL", definition: "Teknolojinin olgunluğunu 1 ile 9 arasında değerlendiren seviye sistemi." },
      { term: "Hibe / Eş Finansman", definition: "Proje maliyetinin bir kısmının fon sağlayıcı tarafından karşılanması." },
    ],
    articles: guideCards,
  },
};
const searchSynonyms = {
  tubitak: ["tübitak", "tubitak", "1001", "1003", "1501", "1507", "1512", "teydeb"],
  "tübitak": ["tübitak", "tubitak", "1001", "1003", "1501", "1507", "1512", "teydeb"],
  avrupa: ["avrupa", "eu", "ab", "europe", "horizon", "ufuk", "eureka", "eurostars", "euresearch", "euroaccess"],
  eu: ["avrupa", "eu", "ab", "europe", "horizon", "ufuk", "eureka", "eurostars"],
  ab: ["avrupa", "eu", "ab", "europe", "horizon", "ufuk", "eureka", "eurostars"],
  ulusal: ["ulusal", "turkiye", "türkiye", "tubitak", "tübitak", "tuseb", "tüseb", "kosgeb"],
  turkiye: ["ulusal", "turkiye", "türkiye", "tubitak", "tübitak", "tuseb", "tüseb", "kosgeb"],
  "türkiye": ["ulusal", "turkiye", "türkiye", "tubitak", "tübitak", "tuseb", "tüseb", "kosgeb"],
  uluslararasi: ["uluslararasi", "uluslararası", "yurtdisi", "yurtdışı", "international", "global", "grants.gov", "grantsgov", "abd", "usa"],
  "uluslararası": ["uluslararasi", "uluslararası", "yurtdisi", "yurtdışı", "international", "global", "grants.gov", "grantsgov", "abd", "usa"],
  yurtdisi: ["uluslararasi", "uluslararası", "yurtdisi", "yurtdışı", "international", "global", "grants.gov", "grantsgov", "abd", "usa"],
  "yurtdışı": ["uluslararasi", "uluslararası", "yurtdisi", "yurtdışı", "international", "global", "grants.gov", "grantsgov", "abd", "usa"],
  saglik: ["saglik", "sağlık", "health", "tuseb", "tüseb", "biotechnology", "medical"],
  "sağlık": ["saglik", "sağlık", "health", "tuseb", "tüseb", "biotechnology", "medical"],
  yapay: ["yapay", "zeka", "ai", "artificial", "intelligence", "digital", "dijital"],
  zeka: ["yapay", "zeka", "ai", "artificial", "intelligence", "digital", "dijital"],
  kobi: ["kobi", "sme", "kobı", "şirket", "sirket", "sanayi", "industry", "kosgeb"],
  kosgeb: ["kosgeb"],
  yesil: ["yesil", "yeşil", "green", "climate", "iklim", "sustainability", "sürdürülebilir", "enerji"],
  "yeşil": ["yesil", "yeşil", "green", "climate", "iklim", "sustainability", "sürdürülebilir", "enerji"],
  biomarker: ["biomarker", "biyobelirteç", "clinical", "klinik", "health", "sağlık"],
  clinical: ["clinical", "klinik", "health", "sağlık", "medical", "tıbbi"],
  youth: ["youth", "gençlik", "genç", "children", "çocuk"],
  violence: ["violence", "şiddet", "suicide", "intihar", "prevention", "önleme"],
  naval: ["naval", "defense", "savunma", "warfare", "aircraft"],
};
const keywordPatterns = [
  {
    value: "digital-ai",
    label: "Dijital dönüşüm ve yapay zeka",
    hint: "AI, veri, siber güvenlik, yazılım, ağ teknolojileri",
    terms: ["yapay zeka", "artificial intelligence", "machine learning", "makine öğrenmesi", "digital", "dijital", "data", "veri", "security", "cyber", "siber", "network", "software", "technology", "technologies"],
  },
  {
    value: "health-clinical",
    label: "Sağlık ve klinik araştırma",
    hint: "Sağlık, biyoteknoloji, klinik çalışma, biyobelirteç",
    terms: ["sağlık", "saglik", "health", "clinical", "klinik", "medical", "biomedical", "biyomedikal", "biomarker", "biyobelirteç", "biotechnology", "biyoteknoloji", "patient", "hastane"],
  },
  {
    value: "energy-climate",
    label: "Enerji, iklim ve çevre",
    hint: "Enerji, iklim, yeşil dönüşüm, sürdürülebilirlik",
    terms: ["enerji", "energy", "climate", "iklim", "green", "yeşil", "sustainability", "sürdürülebilir", "environment", "çevre", "carbon", "karbon", "clean", "temiz"],
  },
  {
    value: "sme-innovation",
    label: "KOBİ, girişim ve inovasyon",
    hint: "KOBİ, startup, şirket, ticarileşme, yatırım",
    terms: ["kobi", "sme", "startup", "girişim", "girisim", "company", "şirket", "sirket", "innovation", "inovasyon", "commercial", "ticarileşme", "yatırım", "investment"],
  },
  {
    value: "agriculture-food",
    label: "Tarım, gıda ve kırsal kalkınma",
    hint: "Tarım, gıda, kırsal destek, üretici ve kooperatif",
    terms: ["tarım", "tarim", "agriculture", "food", "gıda", "gida", "rural", "kırsal", "kirsal", "farmer", "çiftçi", "ciftci", "cooperative", "kooperatif"],
  },
  {
    value: "education-youth",
    label: "Eğitim, gençlik ve sosyal etki",
    hint: "Eğitim, gençlik, çocuk, şiddet önleme, sosyal programlar",
    terms: ["eğitim", "egitim", "education", "school", "okul", "student", "öğrenci", "ogrenci", "youth", "genç", "genc", "children", "çocuk", "cocuk", "violence", "şiddet", "siddet", "suicide", "intihar", "social", "sosyal"],
  },
  {
    value: "public-civil",
    label: "Kamu, STK ve yerel yönetim",
    hint: "Belediye, kamu, STK, vakıf, yerel aktörler",
    terms: ["kamu", "public", "belediye", "municipality", "stk", "ngo", "nonprofit", "dernek", "vakıf", "vakif", "local", "yerel", "civil", "civic"],
  },
  {
    value: "research-partnership",
    label: "Akademik araştırma ve ortaklık",
    hint: "Üniversite, konsorsiyum, araştırmacı, ortak proje",
    terms: ["akadem", "üniversite", "universite", "university", "researcher", "araştırmacı", "arastirmaci", "partnership", "ortaklık", "ortaklik", "consortium", "konsorsiyum", "doctoral", "doktora", "postdoc"],
  },
];

function formatDate(value) {
  if (!value) return "Tarih bekleniyor";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "Tarih bekleniyor";
    return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(d);
  } catch { return "Tarih bekleniyor"; }
}

function normalizeSearch(value = "") {
  return String(value)
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

function tokenizeSearch(value = "") {
  return normalizeSearch(value).split(" ").filter(Boolean);
}

function keywordTextFields(call) {
  return [
    call.title,
    call.funder,
    call.institution,
    call.category,
    call.programme,
    call.thematicArea,
    call.supportType,
    call.support,
    call.summary,
    call.source,
    call.externalId,
    call.callCode,
    ...(call.categories || []),
    ...(call.eligibleCountries || []),
    ...(call.eligibleInstitutions || []),
    ...targetGroups(call),
  ].filter(Boolean);
}

function keywordOptionFields(call) {
  return [
    call.title,
    call.category,
    call.programme,
    call.thematicArea,
    call.supportType,
    call.support,
    call.summary,
    ...(call.categories || []),
    ...(call.eligibleInstitutions || []),
  ].filter(Boolean);
}

function keywordOptionSearchText(call) {
  return normalizeSearch(keywordOptionFields(call).join(" "));
}

function callKeywords(call) {
  const joined = normalizeSearch([...keywordTextFields(call), call.scope, scopeLabel(call.scope)].filter(Boolean).join(" "));
  const tokens = new Set(joined.split(" ").filter(Boolean));
  if (call.scope === "Ulusal") ["ulusal", "turkiye"].forEach((token) => tokens.add(token));
  if (call.scope === "Avrupa") ["avrupa", "ab", "eu", "europe", "horizon", "ufuk"].forEach((token) => tokens.add(token));
  if (call.scope === "Yurtdışı") ["uluslararasi", "yurtdisi", "international", "global"].forEach((token) => tokens.add(token));
  if (/tübitak|tubitak/i.test(call.funder)) ["tubitak", "tübitak", "1001", "1003", "1501", "1507", "teydeb"].forEach((token) => tokens.add(normalizeSearch(token)));
  if (/tüseb|tuseb/i.test(call.funder)) ["tuseb", "tüseb", "saglik", "sağlık"].forEach((token) => tokens.add(normalizeSearch(token)));
  if (/kosgeb/i.test(call.funder)) ["kosgeb", "kobi", "sme", "girisim", "girişim"].forEach((token) => tokens.add(normalizeSearch(token)));
  if (/horizon|ufuk|eureka|euro/i.test(`${call.funder} ${call.source} ${call.title}`)) ["avrupa", "ab", "eu", "horizon", "ufuk", "eureka"].forEach((token) => tokens.add(token));
  if (/grants/i.test(`${call.funder} ${call.source}`)) ["uluslararasi", "yurtdisi", "abd", "usa", "grantsgov"].forEach((token) => tokens.add(token));
  return [...tokens].join(" ");
}

function keywordMatchesCall(call, keyword) {
  const pattern = keywordPatterns.find((item) => item.value === keyword || item.label === keyword);
  if (pattern) return keywordPatternMatchesCall(call, pattern);
  const terms = tokenizeSearch(keyword);
  const haystack = keywordOptionSearchText(call);
  return terms.length > 0 && terms.every((term) => haystack.includes(term));
}

function keywordPatternMatchesCall(call, pattern) {
  const haystack = keywordOptionSearchText(call);
  return pattern.terms.some((term) => {
    const tokens = tokenizeSearch(term);
    return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
  });
}

function keywordLabel(value) {
  return keywordPatterns.find((item) => item.value === value || item.label === value)?.label || value;
}

function buildKeywordOptions(calls) {
  return keywordPatterns
    .map((pattern) => ({
      ...pattern,
      count: calls.filter((call) => keywordPatternMatchesCall(call, pattern)).length,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "tr"));
}

function expandedSearchTerms(query) {
  const tokens = tokenizeSearch(query);
  const expanded = new Set(tokens);
  tokens.forEach((token) => {
    (searchSynonyms[token] || []).forEach((synonym) => expanded.add(normalizeSearch(synonym)));
  });
  return [...expanded].filter(Boolean);
}

function searchGroups(query) {
  return tokenizeSearch(query).map((token) => {
    const group = new Set([token]);
    (searchSynonyms[token] || []).forEach((synonym) => group.add(normalizeSearch(synonym)));
    return [...group].filter(Boolean);
  });
}

function callStatusGroup(call) {
  const normalized = call.normalizedStatus || "";
  if (["OPEN", "CLOSING_SOON", "EXTENDED"].includes(normalized)) return "open";
  if (["UPCOMING", "ANNOUNCED"].includes(normalized)) return "upcoming";
  if (["CLOSED", "ARCHIVED", "CANCELLED", "RESULT_PUBLISHED"].includes(normalized)) return "closed";
  return call.status || "upcoming";
}

function matchesCategory(call, category) {
  if (!category) return true;
  return call.category === category || call.programme === category || (call.categories || []).includes(category);
}

function matchesSearch(call, groups) {
  if (!groups.length) return true;
  const haystack = call.searchIndex || callKeywords(call);
  return groups.every((group) => group.some((term) => haystack.includes(term)));
}

function normalizedIncludes(value, query) {
  if (!query) return true;
  return normalizeSearch(value).includes(normalizeSearch(query));
}

function callBudgetRange(call) {
  const min = Number(call.budgetMin ?? call.budgetMax ?? 0) || null;
  const max = Number(call.budgetMax ?? call.budgetMin ?? 0) || null;
  return { min, max };
}

function isOfficialCall(call) {
  if (call.isOfficial === true || call.sourceType === "official") return true;
  if (call.officialUrl && call.url && call.officialUrl === call.url) return true;
  return call.reviewStatus === "approved" && (call.confidenceScore || 0) >= 80;
}

function formatDateTime(value) {
  if (!value) return "Henüz çekim yok";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "Henüz çekim yok";
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch { return "Henüz çekim yok"; }
}

function formatRelativeTime(value) {
  if (!value) return "Bu taramada eklendi";
  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaHours = Math.max(0, Math.round(deltaMs / 3600000));
  if (deltaHours < 1) return "Bu saat içinde yakalandı";
  if (deltaHours < 24) return `${deltaHours} saat önce yakalandı`;
  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays === 1) return "Dün yakalandı";
  return `${deltaDays} gün önce yakalandı`;
}

function daysLeft(value) {
  if (!value) return null;
  return Math.ceil((new Date(value).setHours(23, 59, 59, 999) - Date.now()) / 86400000);
}

function statusLabel(value) {
  return {
    all: "Tümü",
    open: "Açık",
    upcoming: "Yakında",
    closed: "Kapandı",
    OPEN: "Açık",
    CLOSING_SOON: "Yakında Kapanıyor",
    EXTENDED: "Süre Uzatıldı",
    UPCOMING: "Yakında",
    CLOSED: "Kapandı",
    CANCELLED: "İptal",
    PAUSED: "Askıda",
    RESULT_PUBLISHED: "Sonuç Yayında",
    UNKNOWN: "Kontrol Ediliyor",
  }[value] || value;
}

function booleanFilterParam(value) {
  return ["1", "true", "yes", "evet"].includes(String(value || "").toLocaleLowerCase("tr-TR"));
}

function confidenceLabel(value) {
  if (typeof value === "number") {
    if (value >= 90) return "Doğrulanmış resmi kaynak";
    if (value >= 75) return "Resmi kaynak";
    if (value >= 50) return "Editör kontrolü önerilir";
    return "Manuel inceleme";
  }
  return {
    "yüksek": "Resmi kaynak",
    "orta": "Duyurudan çıkarıldı",
    "kontrol": "Portal kontrolü",
  }[value] || value;
}

function scopeLabel(value) {
  return {
    "Ulusal": "Türkiye",
    "Avrupa": "Avrupa",
    "Yurtdışı": "Uluslararası",
  }[value] || value;
}

function scopeToQuery(value) {
  return {
    "Ulusal": "national",
    "Avrupa": "europe",
    "Yurtdışı": "international",
    "Tümü": "all",
  }[value] || "all";
}

function queryToScope(value) {
  if (!value) return "Tümü";
  return {
    national: "Ulusal",
    ulusal: "Ulusal",
    europe: "Avrupa",
    avrupa: "Avrupa",
    international: "Yurtdışı",
    uluslararasi: "Yurtdışı",
    all: "Tümü",
  }[value] || "Tümü";
}

function routeScope(pathname) {
  if (pathname === "/cagrilar/ulusal") return "Ulusal";
  if (pathname === "/cagrilar/avrupa") return "Avrupa";
  if (pathname === "/cagrilar/uluslararasi") return "Yurtdışı";
  return null;
}

function inferScopeFromFunder(funder, calls) {
  if (!funder) return null;
  const scopeCounts = new Map();
  calls.forEach((call) => {
    if (call.funder !== funder && call.institution !== funder) return;
    scopeCounts.set(call.scope, (scopeCounts.get(call.scope) || 0) + 1);
  });
  return [...scopeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function inferScopeFromFilters(filters, calls, pathname) {
  const lockedScope = routeScope(pathname);
  if (lockedScope) return lockedScope;
  if (filters.scope && filters.scope !== "Tümü") return filters.scope;
  return inferScopeFromFunder(filters.funder, calls) || "Tümü";
}

function calendarLinks(call) {
  const start = call.deadline ? new Date(call.deadline) : new Date();
  const ymd = start.toISOString().slice(0, 10).replace(/-/g, "");
  const text = encodeURIComponent(call.title);
  const cleanSummary = String(call.summary || call.category || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const callUrl = call.url || "";
  const details = encodeURIComponent(`${cleanSummary}\n${callUrl}`);
  const url = encodeURIComponent(callUrl);
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${ymd}/${ymd}&details=${details}&location=${url}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${text}&startdt=${start.toISOString()}&body=${details}`,
    ics: `/api/v1/calls/${encodeURIComponent(call.id)}/calendar.ics`,
  };
}

function currencyLabel(value = "") {
  return { TRY: "TL", TL: "TL", EUR: "EUR", USD: "USD" }[String(value).toLocaleUpperCase("tr-TR")] || value;
}

function formatBudget(call) {
  if (call.budgetMax) {
    const currency = currencyLabel(call.currency);
    const max = `${Number(call.budgetMax).toLocaleString("tr-TR")} ${currency}`.trim();
    if (call.budgetMin) return `${Number(call.budgetMin).toLocaleString("tr-TR")} - ${max}`;
    return max;
  }
  if (call.support && !/belirtilir|doküman|detay|değişir/i.test(call.support)) return call.support;
  return "Resmî çağrı metninde belirtilir";
}

function formatSupportRate(call) {
  if (call.supportRate) return `%${Number(call.supportRate).toLocaleString("tr-TR")}`;
  if (/genel gider|overhead/i.test(call.support || "")) return call.support;
  return "Çağrı koşullarına göre";
}

function urgencyLabel(call) {
  if (call.normalizedStatus === "EXTENDED") return "Süre uzatıldı";
  if (call.normalizedStatus === "CANCELLED") return "İptal edildi";
  if (call.normalizedStatus === "PAUSED") return "Başvuru askıda";
  const left = daysLeft(call.deadline);
  if (left === null) return "Tarih bekleniyor";
  if (left < 0) return `${Math.abs(left)} gün önce kapandı`;
  if (left === 0) return "Bugün son gün";
  return `Son ${left} gün`;
}

function sourceBadge(call) {
  if (call.requiresManualReview) return "Manuel inceleme";
  if ((call.confidenceScore || 0) >= 90) return "Doğrulanmış";
  if ((call.confidenceScore || 0) >= 75) return "Resmi kaynak";
  return confidenceLabel(call.confidence);
}

function deadlineProgress(call) {
  const left = daysLeft(call.deadline);
  if (left === null) return 35;
  if (left <= 0) return 100;
  return Math.max(14, Math.min(100, 100 - (left / 90) * 100));
}

function publishedTime(call) {
  return call.publishedAt ? new Date(call.publishedAt).getTime() : 0;
}

function deadlineTime(call) {
  return call.deadline ? new Date(call.deadline).getTime() : Number.MAX_SAFE_INTEGER;
}

function monthLabel() {
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date());
}

function callPath(call) {
  return `/cagrilar/${encodeURIComponent(call.slug || call.id)}`;
}

function getRoute() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  return { pathname, params: new URLSearchParams(window.location.search) };
}

function useRoute() {
  const [route, setRoute] = useState(getRoute);
  useEffect(() => {
    const update = () => setRoute(getRoute());
    window.addEventListener("popstate", update);
    window.addEventListener("pushstate", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("pushstate", update);
    };
  }, []);
  return route;
}

function navigate(path) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("pushstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function useCalls() {
  const [state, setState] = useState({ calls: [], errors: [], fetchedAt: null, loading: true });

  const refresh = useCallback(async ({ force = false } = {}) => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const apiKey = force ? window.prompt('Admin API Key:') : null;
      if (force && !apiKey) {
        setState((current) => ({ ...current, loading: false }));
        return;
      }
      const url = force ? `/api/calls/refresh?api_key=${apiKey}` : "/api/calls";
      const response = await fetch(url, { method: force ? "POST" : "GET" });
      const payload = await response.json();
      setState({ ...payload, loading: false });
    } catch (error) {
      setState({ calls: [], errors: [{ source: "Uygulama", message: error.message }], fetchedAt: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
    let intervalTimer;
    const hourlyTimer = setTimeout(() => {
      refresh();
      intervalTimer = setInterval(refresh, REFRESH_INTERVAL_MS);
    }, msUntilNextHour());
    return () => {
      clearTimeout(hourlyTimer);
      if (intervalTimer) clearInterval(intervalTimer);
    };
  }, [refresh]);

  return { ...state, refresh };
}

function mergeSiteContent(content = {}) {
  return {
    images: { ...defaultSiteContent.images, ...(content.images || {}) },
    home: { ...defaultSiteContent.home, ...(content.home || {}) },
    guide: {
      ...defaultSiteContent.guide,
      ...(content.guide || {}),
      categories: content.guide?.categories?.length ? content.guide.categories : defaultSiteContent.guide.categories,
      glossary: content.guide?.glossary?.length ? content.guide.glossary : defaultSiteContent.guide.glossary,
      articles: content.guide?.articles?.length ? content.guide.articles : defaultSiteContent.guide.articles,
    },
  };
}

function useSiteContent() {
  const [state, setState] = useState({ content: defaultSiteContent, loading: true, error: "" });
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/site-content");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "İçerik alınamadı.");
      setState({ content: mergeSiteContent(payload.content), loading: false, error: "" });
    } catch (error) {
      setState({ content: defaultSiteContent, loading: false, error: error.message || "İçerik alınamadı." });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}

function usePageMeta(title, description, options = {}) {
  useEffect(() => {
    const canonicalPath = window.location.pathname;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const image = options.image || `${SITE_URL}/logo.png`;
    const keywords = options.keywords || DEFAULT_SEO_KEYWORDS;

    document.title = title;
    const metas = [
      ["description", description],
      ["keywords", keywords],
      ["robots", "index, follow"],
      ["og:title", title, "property"],
      ["og:description", description, "property"],
      ["og:type", "website", "property"],
      ["og:site_name", SITE_NAME, "property"],
      ["og:locale", "tr_TR", "property"],
      ["og:url", canonicalUrl, "property"],
      ["og:image", image, "property"],
      ["twitter:card", "summary_large_image"],
      ["twitter:title", title],
      ["twitter:description", description],
      ["twitter:image", image],
    ];
    metas.forEach(([name, content, attr = "name"]) => {
      let meta = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    });
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);
  }, [title, description, options.image, options.keywords]);
}

function filterCalls(calls, filters) {
  const groups = searchGroups(filters.query);
  const deadlineLimit = filters.deadlineWithin ? Number(filters.deadlineWithin) : null;
  const budgetMin = filters.budgetMin ? Number(filters.budgetMin) : null;
  const budgetMax = filters.budgetMax ? Number(filters.budgetMax) : null;
  return calls.filter((call) => {
    const left = daysLeft(call.deadline);
    const deadlineMs = call.deadline ? new Date(call.deadline).getTime() : null;
    const deadlineFrom = filters.deadlineFrom ? new Date(filters.deadlineFrom).getTime() : null;
    const deadlineTo = filters.deadlineTo ? new Date(filters.deadlineTo).getTime() : null;
    const budget = callBudgetRange(call);
    return (
      matchesSearch(call, groups) &&
      (!filters.keyword || keywordMatchesCall(call, filters.keyword)) &&
      (filters.scope === "Tümü" || call.scope === filters.scope) &&
      (filters.status === "all" || callStatusGroup(call) === filters.status) &&
      matchesCategory(call, filters.category) &&
      (!filters.funder || call.funder === filters.funder) &&
      (!filters.targetGroup || targetGroups(call).some((group) => normalizedIncludes(group, filters.targetGroup))) &&
      (!filters.thematicArea || callThemes(call).some((theme) => normalizedIncludes(theme, filters.thematicArea)) || matchesSearch(call, searchGroups(filters.thematicArea))) &&
      (!filters.country || call.country === filters.country || (call.eligibleCountries || []).includes(filters.country)) &&
      (!filters.currency || call.currency === filters.currency) &&
      (!budgetMin || (budget.max && budget.max >= budgetMin)) &&
      (!budgetMax || (budget.min && budget.min <= budgetMax)) &&
      (!deadlineFrom || (deadlineMs && deadlineMs >= deadlineFrom)) &&
      (!deadlineTo || (deadlineMs && deadlineMs <= deadlineTo)) &&
      (!filters.officialOnly || isOfficialCall(call)) &&
      (!deadlineLimit || (left !== null && left >= 0 && left <= deadlineLimit))
    );
  }).sort((a, b) => {
    if (filters.sort === "deadline_desc") return deadlineTime(b) - deadlineTime(a);
    if (filters.sort === "newest") return publishedTime(b) - publishedTime(a);
    return deadlineTime(a) - deadlineTime(b);
  });
}

function DetailItem({ label, value }) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return null;
  return (
    <div className="detailItem">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="sectionTitle">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

function Header({ route, siteContent }) {
  const [open, setOpen] = useState(false);
  const active = (href) => href === "/" ? route.pathname === "/" : route.pathname.startsWith(href);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1181px)");
    const closeDesktopMenu = (event) => {
      if (event.matches) setOpen(false);
    };

    closeDesktopMenu(query);
    query.addEventListener("change", closeDesktopMenu);
    return () => query.removeEventListener("change", closeDesktopMenu);
  }, []);

  return (
    <header className="topNav">
      <a className="brand" href="/" onClick={(event) => {
        event.preventDefault();
        navigate("/");
      }} aria-label="Hibe Rota ana sayfa">
        <img className="brandLogo" src={siteContent.images.logoSvg || "/logo.svg"} alt="" aria-hidden="true" />
        <strong>Hibe Rota</strong>
      </a>
      <nav>
        {routeLinks.slice(0, 6).map((item) => (
          <div className="navItem" key={item.href}>
            <a className={active(item.href) ? "active" : ""} href={item.href} onClick={(event) => {
              event.preventDefault();
              navigate(item.href);
            }}>{item.label}</a>
            {item.children && (
              <div className="navDropdown">
                {item.children.map((child) => (
                  <a key={child.href} href={child.href} onClick={(event) => {
                    event.preventDefault();
                    navigate(child.href);
                  }}>{child.label}</a>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <button className="mobileMenuButton" type="button" aria-label="Menüyü aç" onClick={() => setOpen((value) => !value)}>
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      <a className="navCta" href="/iletisim" onClick={(event) => {
        event.preventDefault();
        navigate("/iletisim");
      }}>İletişim</a>
      {open && (
        <div className="mobileMenu">
          {routeLinks.map((item) => (
            <a key={item.href} href={item.href} className={active(item.href) ? "active" : ""} onClick={(event) => {
              event.preventDefault();
              setOpen(false);
              navigate(item.href);
            }}>{item.label}</a>
          ))}
        </div>
      )}
    </header>
  );
}

function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb content" aria-label="Sayfa konumu">
      <a href="/" onClick={(event) => {
        event.preventDefault();
        navigate("/");
      }}>Ana Sayfa</a>
      {items.map((item) => (
        <React.Fragment key={item.label}>
          <span>/</span>
          {item.href ? (
            <a href={item.href} onClick={(event) => {
              event.preventDefault();
              navigate(item.href);
            }}>{item.label}</a>
          ) : (
            <strong>{item.label}</strong>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

function PageHero({ eyebrow, title, text, children }) {
  return (
    <section className="pageHero content">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      {children}
    </section>
  );
}

function Footer() {
  const links = [
    ["Platform", [["Çağrılar", "/cagrilar"], ["Destek Programları", "/programlar"], ["Kurumlar", "/kurumlar"], ["Çağrı Takvimi", "/takvim"]]],
    ["Çağrı Kategorileri", [["Ulusal Çağrılar", "/cagrilar/ulusal"], ["Avrupa Çağrıları", "/cagrilar/avrupa"], ["Uluslararası", "/cagrilar/uluslararasi"], ["Yaklaşan Başvurular", "/cagrilar/yaklasan"]]],
    ["Kurumsal", [["Hakkımızda", "/hakkimizda"], ["İletişim", "/iletisim"], ["SSS", "/sss"], ["Gizlilik Politikası", "/gizlilik-politikasi"], ["Kullanım Koşulları", "/kullanim-kosullari"]]],
  ];
  return (
    <footer className="footer">
      <div className="content footerGrid">
        <div>
          <strong>Hibe Rota</strong>
          <p>Doğru fırsatlara giden en kısa rota. Hibe, fon, destek ve proje çağrılarını tek noktada keşfedin.</p>
          <a href="/rss/all.xml">RSS Akışı</a>
        </div>
        {links.map(([title, items]) => (
          <div key={title}>
            <span>{title}</span>
            {items.map(([label, href]) => (
              <a key={href} href={href} onClick={(event) => {
                event.preventDefault();
                navigate(href);
              }}>{label}</a>
            ))}
          </div>
        ))}
      </div>
    </footer>
  );
}

function CompactCall({ call, variant }) {
  const metaLabel =
    variant === "new"
      ? "Yeni"
      : variant === "detected"
        ? formatRelativeTime(call.firstDetectedAt || call.lastDetectedAt)
        : urgencyLabel(call);

  const daysLeftNum = daysLeft(call.deadline);
  const isUrgent = daysLeftNum !== null && daysLeftNum <= 10 && (variant === "urgent" || !variant || variant === "favorite");

  return (
    <a className="compactCall" href={callPath(call)} onClick={(event) => {
      event.preventDefault();
      navigate(callPath(call));
    }}>
      <span className={`compactDot ${variant || call.scope}`}></span>
      <div>
        <strong>{cleanHtml(call.title)}</strong>
        <span>{cleanHtml(call.funder)}</span>
      </div>
      <em className={isUrgent ? "urgentText" : ""}>{metaLabel}</em>
    </a>
  );
}

function CallCard({ call, selected, onSelect, mode = "expand" }) {
  const progress = deadlineProgress(call);
  const links = calendarLinks(call);
  const asDetail = mode === "link";
  const closed = isClosedCall(call);
  const statusTone = closed ? "closed" : callStatusGroup(call) === "upcoming" ? "upcoming" : "open";
  const audienceChips = audienceChipLabels(call);
  const visibleAudienceChips = audienceChips.slice(0, 4);
  const hiddenAudienceCount = Math.max(0, audienceChips.length - visibleAudienceChips.length);
  const openDetail = (event) => {
    event.stopPropagation();
    navigate(callPath(call));
  };

  return (
    <article 
      className={`callCard ${selected ? "selected" : ""} scopeCard-${call.scope}`} 
    >
      <a href={callPath(call)} className="cardLinkOverlay" aria-label={`${cleanHtml(call.title)} detayları`} onClick={(e) => {
        if (e.button === 1 || e.metaKey || e.ctrlKey) return; // Allow middle-click and ctrl-click native behavior
        e.preventDefault();
        if (asDetail) {
          openDetail(e);
        } else if (onSelect) {
          onSelect(e);
        }
      }}></a>
      <div className="progressLine" style={{ width: `${progress}%` }}></div>
      {!asDetail && (
        <button
          className="cardClose"
          type="button"
          aria-label="Detayı kapat"
          onClick={(event) => {
            event.stopPropagation();
            if (onSelect) onSelect(true);
          }}
        >
          <X size={16} />
        </button>
      )}
      <div className="cardTop">
        <span className="cardType"><BadgeCheck size={17} /> CallCard</span>
        <span className={`statusChip ${statusTone}`}>{statusLabel(call.normalizedStatus || call.status)}</span>
        <span className={`scopeChip scope-${call.scope}`}>{scopeLabel(call.scope)}</span>
        <FavoriteButton callId={call.id} className="cardFavorite" label="Favori" />
      </div>
      <h3>{cleanHtml(call.title)}</h3>
      <div className="cardAudience" aria-label={`Kimler başvurabilir: ${audienceChips.join(", ")}`}>
        <span className="cardAudienceLabel"><Users size={14} /> Kimler başvurabilir?</span>
        <div className="cardAudienceChips">
          {visibleAudienceChips.map((label) => <span key={label}>{label}</span>)}
          {hiddenAudienceCount > 0 && <span>+{hiddenAudienceCount}</span>}
        </div>
      </div>
      <p>{cleanHtml(call.summary || call.category)}</p>
      <div className="cardMetaLine">
        <span>{call.funder}</span>
        <span><ShieldCheck size={14} /> {sourceBadge(call)}</span>
      </div>
      <div className="cardFacts">
        <DetailItem label="Destek Tutarı" value={formatBudget(call)} />
        <DetailItem label="Son Başvuru" value={formatDate(call.deadline)} />
        <DetailItem label="Kalan" value={urgencyLabel(call)} />
      </div>
      {selected && (
        <div className="cardDetails">
          <div className="detailGrid">
            <DetailItem label="Kategori" value={call.category} />
            <DetailItem label="Kaynak" value={call.source} />
            <DetailItem label="Durum" value={statusLabel(call.normalizedStatus || call.status)} />
            <DetailItem label="Kalan Süre" value={urgencyLabel(call)} />
            <DetailItem label="Son Doğrulama" value={formatDateTime(call.lastVerifiedAt)} />
            <DetailItem label="Güvenilirlik" value={sourceBadge(call)} />
          </div>
          <div className="detailActions" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="primaryAction buttonLink" onClick={openDetail}>Detayları İncele <ArrowRight size={15} /></button>
            {call.url && <a href={ensureHttp(call.url)} target="_blank" rel="noopener noreferrer">Resmi Başvuru <ArrowUpRight size={15} /></a>}
            <a href={links.ics}>ICS indir</a>
          </div>
        </div>
      )}
    </article>
  );
}

function FilterPanel({
  calls,
  filters,
  setFilters,
  categories,
  funders,
  targetGroupOptions,
  keywordOptions,
  themeOptions,
  countryOptions,
  currencyOptions,
  refresh,
  loading,
  fetchedAt,
  lockedScope,
  resultCount,
}) {
  const update = (key, value) => setFilters((current) => {
    const next = { ...current, [key]: value };
    if (key === "funder" && !lockedScope) {
      next.scope = value ? (inferScopeFromFunder(value, calls) || "Tümü") : "Tümü";
    }
    if (key === "scope" && value === "Tümü" && next.funder && !lockedScope) {
      next.scope = inferScopeFromFilters(next, calls, "/cagrilar");
    }
    return next;
  });
  return (
    <aside className="filterPanel" aria-label="Çağrı filtreleri">
      <div className="filterHeader">
        <div>
          <h2>Filtreler</h2>
          <p>{resultCount} uygun çağrı</p>
        </div>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, ...defaultCallFilters, scope: lockedScope || "Tümü" }))}>Temizle</button>
      </div>
      <label className="fieldLabel">
        <span>Arama</span>
        <span className="inlineSearch">
          <Search size={20} />
          <input value={filters.query} onChange={(event) => update("query", event.target.value)} placeholder="Kurum, program veya proje alanı ara" />
        </span>
      </label>
      <span className="filterGroupTitle">Otomasyon anahtar kelimeleri</span>
      <div className="keywordPatternGrid" aria-label="Otomasyon anahtar kelime kalıpları">
        {keywordOptions.map((item) => (
          <button key={item.value} type="button" className={`${filters.keyword === item.value ? "active" : ""} ${item.count === 0 ? "empty" : ""}`} onClick={() => update("keyword", filters.keyword === item.value ? "" : item.value)}>
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
            <em>{item.count} çağrı</em>
          </button>
        ))}
      </div>
      <span className="filterGroupTitle">Kapsam</span>
      <div className="segmentGroup" aria-label="Çağrı türü filtresi">
        {filterTabs.map((tab) => (
          <button key={tab.value} type="button" disabled={Boolean(lockedScope) && lockedScope !== tab.value} className={filters.scope === tab.value ? "active" : ""} onClick={() => update("scope", tab.value)}>
            <span className={`segmentDot ${tab.dot}`}></span>
            {tab.label}
          </button>
        ))}
      </div>
      <span className="filterGroupTitle">Uygunluk</span>
      <div className="selectGrid">
        <label>
          <span>Durum</span>
          <select value={filters.status} onChange={(event) => update("status", event.target.value)}>
            <option value="open">Açık</option>
            <option value="upcoming">Yakında</option>
            <option value="closed">Kapandı</option>
            <option value="all">Tümü</option>
          </select>
        </label>
        <label>
          <span>Hedef kitle</span>
          <select value={filters.targetGroup} onChange={(event) => update("targetGroup", event.target.value)}>
            <option value="">Tüm başvuru sahipleri</option>
            {targetGroupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
        </label>
        <label>
          <span>Alan / tema</span>
          <select value={filters.thematicArea} onChange={(event) => update("thematicArea", event.target.value)}>
            <option value="">Tüm alanlar</option>
            {themeOptions.map((theme) => <option key={theme} value={theme}>{theme}</option>)}
          </select>
        </label>
        <label>
          <span>Kategori</span>
          <select value={filters.category} onChange={(event) => update("category", event.target.value)}>
            <option value="">Tüm kategoriler</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          <span>Kurum</span>
          <select value={filters.funder} onChange={(event) => update("funder", event.target.value)}>
            <option value="">Tüm kurumlar</option>
            {funders.map((funder) => <option key={funder} value={funder}>{funder}</option>)}
          </select>
        </label>
        <label>
          <span>Uygun ülke</span>
          <select value={filters.country} onChange={(event) => update("country", event.target.value)}>
            <option value="">Tüm ülkeler</option>
            {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
        </label>
      </div>
      <span className="filterGroupTitle">Zaman ve bütçe</span>
      <div className="selectGrid">
        <label>
          <span>Son tarih</span>
          <select value={filters.deadlineWithin} onChange={(event) => update("deadlineWithin", event.target.value)}>
            <option value="">Tüm tarihler</option>
            <option value="7">7 gün içinde</option>
            <option value="30">30 gün içinde</option>
            <option value="45">45 gün içinde</option>
            <option value="90">90 gün içinde</option>
          </select>
        </label>
        <label>
          <span>Başlangıç tarihi</span>
          <input type="date" value={filters.deadlineFrom} onChange={(event) => update("deadlineFrom", event.target.value)} />
        </label>
        <label>
          <span>Bitiş tarihi</span>
          <input type="date" value={filters.deadlineTo} onChange={(event) => update("deadlineTo", event.target.value)} />
        </label>
        <label>
          <span>Min. bütçe</span>
          <input type="number" min="0" inputMode="numeric" value={filters.budgetMin} onChange={(event) => update("budgetMin", event.target.value)} placeholder="Örn. 100000" />
        </label>
        <label>
          <span>Maks. bütçe</span>
          <input type="number" min="0" inputMode="numeric" value={filters.budgetMax} onChange={(event) => update("budgetMax", event.target.value)} placeholder="Örn. 5000000" />
        </label>
        <label>
          <span>Para birimi</span>
          <select value={filters.currency} onChange={(event) => update("currency", event.target.value)}>
            <option value="">Tümü</option>
            {currencyOptions.map((currency) => <option key={currency} value={currency}>{currencyLabel(currency)}</option>)}
          </select>
        </label>
        <label>
          <span>Sıralama</span>
          <select value={filters.sort} onChange={(event) => update("sort", event.target.value)}>
            <option value="deadline_asc">Son tarih yakın</option>
            <option value="deadline_desc">Son tarih uzak</option>
            <option value="newest">Yeni açılan</option>
          </select>
        </label>
      </div>
      <label className="checkFilter">
        <input type="checkbox" checked={Boolean(filters.officialOnly)} onChange={(event) => update("officialOnly", event.target.checked)} />
        <span>Yalnızca resmî/doğrulanmış kaynakları göster</span>
      </label>
      <div className="syncBox">
        <button className="refresh" onClick={() => refresh()} disabled={loading} title="Verileri güncelle">
          <RefreshCw size={18} className={loading ? "spin" : ""} />
          Yenile
        </button>
        <span><i></i> Her saat başı canlı güncellenir</span>
        <small>Son çekim: {formatDateTime(fetchedAt)}</small>
      </div>
    </aside>
  );
}

function ActiveFilterBar({ filters, total, count, onClear, onReset }) {
  if (!filters.length) {
    return (
      <div className="activeFilterBar empty">
        <span>{count} çağrı listeleniyor</span>
        <small>Filtre ekleyerek başvuru sahibine, bütçeye veya son tarihe göre daraltın.</small>
      </div>
    );
  }
  return (
    <div className="activeFilterBar">
      <div>
        <strong>{count} sonuç</strong>
        <small>{total} çağrı içinden filtrelendi</small>
      </div>
      <div className="activeFilterChips" aria-label="Aktif filtreler">
        {filters.map(([key, label]) => (
          <button key={key} type="button" onClick={() => onClear(key)} title={`${label} filtresini kaldır`}>
            {label}
            <X size={14} />
          </button>
        ))}
        <button className="clearAllChip" type="button" onClick={onReset}>Tümünü temizle</button>
      </div>
    </div>
  );
}

function EmptyState({ title = "Sonuç bulunamadı", text = "Filtreleri değiştirerek tekrar deneyin." }) {
  return <div className="emptyState"><AlertCircle size={24} /><strong>{title}</strong><p>{text}</p></div>;
}

function LoadingState() {
  return <div className="emptyState"><RefreshCw className="spin" size={24} /><strong>Çağrılar yükleniyor</strong><p>Canlı kaynaklar taranıyor.</p></div>;
}

function CallsAside({ calls, errors, siteContent }) {
  const featured = calls[0];
  const upcoming = calls.slice(1, 4);

  return (
    <aside className="callsAside" aria-label="Çağrı özeti">
      <div className="promoPanel">
        <span className="promoMark"><img src={siteContent.images.logoPng || "/logo.png"} alt="" aria-hidden="true" /></span>
        <h2>{siteContent.home.promoTitle}</h2>
        <p>{siteContent.home.promoText}</p>
        <a href="/rehber" onClick={(event) => {
          event.preventDefault();
          navigate("/rehber");
        }}>Rehberi Aç</a>
      </div>

      {featured && (
        <div className="asidePanel">
          <span>Öne Çıkan</span>
          <strong>{featured.title}</strong>
          <p>{featured.funder} · {formatDate(featured.deadline)}</p>
        </div>
      )}
      <div className="asidePanel compact">
        <span>{errors.length ? "Kaynak Uyarıları" : "Kaynak Durumu"}</span>
        <strong>{errors.length ? `${errors.length} uyarı var` : "Kaynaklar aktif"}</strong>
        <p>Sonuçlar canlı katalog ve doğrulama akışından gelir.</p>
      </div>
      {!!upcoming.length && (
        <div className="asidePanel miniList">
          <span>Yaklaşanlar</span>
          {upcoming.map((call) => (
            <a key={call.id} href={callPath(call)} onClick={(event) => {
              event.preventDefault();
              navigate(callPath(call));
            }}>
              <strong>{cleanHtml(call.title)}</strong>
              <em>{urgencyLabel(call)}</em>
            </a>
          ))}
        </div>
      )}
    </aside>
  );
}

function HomePage({ model, filters, setFilters, siteContent }) {
  usePageMeta(DEFAULT_SEO_TITLE, DEFAULT_SEO_DESCRIPTION);
  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          logo: SITE_LOGO_URL,
          description: DEFAULT_SEO_DESCRIPTION,
          sameAs: [],
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: SITE_NAME,
          alternateName: "Hibe ve Fon Çağrı Takip Platformu",
          url: SITE_URL,
          publisher: { "@id": `${SITE_URL}/#organization` },
          description: DEFAULT_SEO_DESCRIPTION,
          inLanguage: "tr-TR",
          keywords: DEFAULT_SEO_KEYWORDS,
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/cagrilar?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
      ],
    };
    let script = document.getElementById("site-jsonld");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "site-jsonld";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
    return () => {
      document.getElementById("site-jsonld")?.remove();
    };
  }, []);

  const { openCalls, urgent, newlyOpened, recentlyDetected, funders, categories, urgentWeek } = model;
  
  const { favoriteIds } = useFavorites();
  const favoriteCalls = useMemo(() => {
    if (!favoriteIds || !favoriteIds.length) return [];
    const set = new Set(favoriteIds);
    return model.calls.filter((c) => set.has(c.id));
  }, [favoriteIds, model.calls]);

  const [activeTab, setActiveTab] = useState("urgent");
  const [heroScope, setHeroScope] = useState("all");

  const tabData = {
    urgent: { label: "Yaklaşanlar", data: urgent.slice(0, 5), fallback: "Yaklaşan son tarih bulunamadı.", link: "/cagrilar/yaklasan" },
    new: { label: "Yeni Açılanlar", data: newlyOpened.slice(0, 5), fallback: "Yeni çağrı bulunamadı.", link: "/cagrilar?sort=newest" },
    detected: { label: "Son Tespitler", data: recentlyDetected.slice(0, 5), fallback: "Son taramalarda çağrı yakalanmadı.", link: "/cagrilar?sort=newest&status=open" }
  };

  const nationalCalls = useMemo(() => {
    return openCalls.filter(call => call.scope === "Ulusal").slice(0, 5);
  }, [openCalls]);

  return (
    <>
      <section className="hero content">
        <div className="heroCopy">
          <h1>{siteContent.home.heroTitle}</h1>
          <p>{siteContent.home.heroText}</p>
        </div>
        {siteContent.images.heroImage && (
          <img className="heroManagedImage" src={siteContent.images.heroImage} alt="" aria-hidden="true" />
        )}
        <form className="heroSearch" onSubmit={(event) => {
          event.preventDefault();
          navigate(`/cagrilar?scope=${heroScope}&q=${encodeURIComponent(filters.query)}`);
        }}>
          <select value={heroScope} onChange={(e) => setHeroScope(e.target.value)} className="heroScopeSelect" aria-label="Kapsam">
            <option value="all">Tüm Kapsamlar</option>
            <option value="national">Sadece Türkiye</option>
            <option value="europe">Sadece Avrupa</option>
            <option value="international">Sadece Uluslararası</option>
          </select>
          <div className="searchInputWrapper">
            <Search size={20} />
            <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Program, kurum, proje alanı veya çağrı adı ara" aria-label="Çağrı arama" />
          </div>
          <button type="submit">Ara</button>
        </form>
        <div className="popularTags">
          <div className="sectorChips">
            {sectorChips.map(({ label, query, icon: Icon }) => (
              <button key={label} type="button" className="chipButton" onClick={() => {
                setFilters((current) => ({ ...current, query, scope: "Tümü" }));
                navigate(`/cagrilar?q=${encodeURIComponent(query)}&scope=all`);
              }}><Icon size={14} aria-hidden="true" />{label}</button>
            ))}
          </div>
        </div>
        <div className="statsInline">
          <span><strong>{catalogData.catalog.length}+</strong> Destek Programı</span>
          <span><strong>{openCalls.length}</strong> Açık Çağrı</span>
          <span><strong>{model.sourceCount}</strong> Aktif Kaynak</span>
        </div>
      </section>

      {favoriteCalls.length > 0 && (
        <section className="content dashboardIntro">
          <div className="dashboardPanel fullWidth">
            <div className="panelTitle">
              <h2><Heart size={23} fill="currentColor" className="text-red" /> Kayıtlı Çağrılarınız</h2>
            </div>
            <div className="compactList horizontalList">
              {favoriteCalls.slice(0, 4).map((call) => <CompactCall key={call.id} call={call} variant="favorite" />)}
            </div>
          </div>
        </section>
      )}

      <section className="audienceBand">
        <div className="content">
          <SectionTitle eyebrow="Hızlı başlangıç" title="Kim İçin Destek Arıyorsunuz?" />
          <div className="audienceGrid">
            {audiences.map(({ label, query, icon: Icon }) => (
              <button key={label} type="button" onClick={() => navigate(`/cagrilar?q=${encodeURIComponent(query)}&scope=all`)}>
                <span><Icon size={24} /></span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="content dashboardIntro">
        <div className="dashboardPanel tabbedPanel">
          <div className="panelTabs">
            {Object.entries(tabData).map(([key, { label }]) => (
              <button key={key} className={`tabButton ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="tabContent">
             <div className="compactList">
               {tabData[activeTab].data.map((call) => <CompactCall key={call.id} call={call} variant={activeTab} />)}
               {!tabData[activeTab].data.length && <p className="emptyInline">{tabData[activeTab].fallback}</p>}
             </div>
             <a href={tabData[activeTab].link} className="ctaButton" onClick={(event) => { event.preventDefault(); navigate(tabData[activeTab].link); }}>Tüm {tabData[activeTab].label} Listesini Gör <ArrowRight size={16} /></a>
          </div>
        </div>
        
        <div className="dashboardPanel listPanel">
          <div className="panelHeader" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)', backgroundColor: 'var(--surface-sunken)' }}>
            <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={20} className="text-red" /> Türkiye'de Aktif Projeler</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-soft)' }}>Türkiye'de açılan güncel destek ve fon başvuruları</p>
          </div>
          <div className="tabContent">
             <div className="compactList">
               {nationalCalls.map((call) => <CompactCall key={call.id} call={call} variant="new" />)}
               {!nationalCalls.length && <p className="emptyInline">Türkiye'de aktif çağrı bulunamadı.</p>}
             </div>
             <a href="/cagrilar/ulusal" className="ctaButton" onClick={(event) => { event.preventDefault(); navigate("/cagrilar/ulusal"); }}>Tüm Türkiye Listesini Gör <ArrowRight size={16} /></a>
          </div>
        </div>
      </section>

      <section className="content homeSummaryGrid">
        <SummaryCard icon={Database} title="Destek Programları" text={`${catalogData.catalog.length} katalog kaydı ve ${categories.length} canlı kategori.`} href="/programlar" />
        <SummaryCard icon={Building2} title="Kurumlar" text={`${model.sourceCount} aktif kaynak ve fon sağlayıcı canlı olarak izleniyor.`} href="/kurumlar" />
        <SummaryCard icon={CalendarDays} title="Çağrı Takvimi" text="Yaklaşan son başvuru tarihlerini takvim görünümünde takip edin." href="/takvim" />
        <SummaryCard icon={BookOpen} title="Proje Rehberi" text="Proje yazımı ve başvuru süreçleri hakkında bilgi alın." href="/rehber" />
      </section>
    </>
  );
}

function SummaryCard({ icon: Icon, title, text, href }) {
  return (
    <article className="summaryCard">
      <Icon size={28} />
      <h2>{title}</h2>
      <p>{text}</p>
      <a href={href} onClick={(event) => { event.preventDefault(); navigate(href); }}>Detayları İncele <ArrowRight size={15} /></a>
    </article>
  );
}

function CallsPage({ route, model, filters, setFilters, refresh, loading, fetchedAt, errors, siteContent }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const scopeFromRoute = routeScope(route.pathname);
  const isUpcoming = route.pathname === "/cagrilar/yaklasan";
  const isNew = route.pathname === "/cagrilar/yeni";
  const pageTitle = isUpcoming ? "Yaklaşan Başvurular" : isNew ? "Yeni Çağrılar" : scopeFromRoute ? `${scopeLabel(scopeFromRoute)} Çağrıları` : "Proje Destek Çağrıları";
  const pageText = "Arama, kapsam, kategori, kurum, başvuru durumu ve son tarihe göre çağrıları filtreleyin.";
  usePageMeta(`${pageTitle} | Hibe Rota`, pageText);
  const pageFilters = useMemo(
    () => ({ ...filters, scope: scopeFromRoute || filters.scope, deadlineWithin: isUpcoming ? "45" : filters.deadlineWithin, sort: isNew ? "newest" : filters.sort }),
    [filters, scopeFromRoute, isUpcoming, isNew],
  );
  const deferredFilters = useDeferredValue(pageFilters);
  const filtered = useMemo(() => filterCalls(model.calls, deferredFilters), [model.calls, deferredFilters]);
  const exportQuery = new URLSearchParams({
    q: filters.query,
    scope: scopeToQuery(pageFilters.scope),
    status: pageFilters.status,
    category: pageFilters.category,
    funder: pageFilters.funder,
    targetGroup: pageFilters.targetGroup,
    keyword: pageFilters.keyword,
    thematicArea: pageFilters.thematicArea,
    country: pageFilters.country,
    currency: pageFilters.currency,
    budgetMin: pageFilters.budgetMin,
    budgetMax: pageFilters.budgetMax,
    deadlineWithin: pageFilters.deadlineWithin,
    deadlineFrom: pageFilters.deadlineFrom,
    deadlineTo: pageFilters.deadlineTo,
    officialOnly: pageFilters.officialOnly ? "true" : "",
    sort: pageFilters.sort,
  }).toString();
  const clearFilter = (key) => setFilters((current) => ({
    ...current,
    [key]: key === "officialOnly" ? false : key === "scope" ? "Tümü" : key === "status" ? "open" : "",
  }));
  const resetFilters = () => setFilters((current) => ({ ...current, ...defaultCallFilters, scope: scopeFromRoute || "Tümü", deadlineWithin: isUpcoming ? "45" : "" }));
  const activeFilters = [
    pageFilters.query && ["query", `Arama: ${pageFilters.query}`],
    pageFilters.scope !== "Tümü" && !scopeFromRoute && ["scope", `Kapsam: ${scopeLabel(pageFilters.scope)}`],
    pageFilters.status !== "open" && ["status", `Durum: ${statusLabel(pageFilters.status)}`],
    pageFilters.category && ["category", `Kategori: ${pageFilters.category}`],
    pageFilters.funder && ["funder", `Kurum: ${pageFilters.funder}`],
    pageFilters.targetGroup && ["targetGroup", `Hedef: ${pageFilters.targetGroup}`],
    pageFilters.keyword && ["keyword", `Kalıp: ${keywordLabel(pageFilters.keyword)}`],
    pageFilters.thematicArea && ["thematicArea", `Tema: ${pageFilters.thematicArea}`],
    pageFilters.country && ["country", `Ülke: ${pageFilters.country}`],
    pageFilters.currency && ["currency", `Para birimi: ${currencyLabel(pageFilters.currency)}`],
    pageFilters.budgetMin && ["budgetMin", `Min. bütçe: ${Number(pageFilters.budgetMin).toLocaleString("tr-TR")}`],
    pageFilters.budgetMax && ["budgetMax", `Maks. bütçe: ${Number(pageFilters.budgetMax).toLocaleString("tr-TR")}`],
    pageFilters.deadlineWithin && !isUpcoming && ["deadlineWithin", `Son tarih: ${pageFilters.deadlineWithin} gün`],
    pageFilters.deadlineFrom && ["deadlineFrom", `Başlangıç: ${formatDate(pageFilters.deadlineFrom)}`],
    pageFilters.deadlineTo && ["deadlineTo", `Bitiş: ${formatDate(pageFilters.deadlineTo)}`],
    pageFilters.officialOnly && ["officialOnly", "Resmî kaynak"],
  ].filter(Boolean);
  return (
    <>
      <Breadcrumb items={[{ label: pageTitle }]} />
      <section className="callsHero content">
        <div>
          <span>Çağrılar</span>
          <h1>{pageTitle}</h1>
          <p>{filtered.length} sonuç</p>
        </div>
        <div className="callsHeroActions">
          <a href={`/api/v1/exports/calls.csv?${exportQuery}`}><FileDown size={16} /> CSV</a>
          <a href={`/api/v1/exports/calls.xlsx?${exportQuery}`}><FileDown size={16} /> Excel</a>
          <a href={`/api/v1/exports/calls.pdf?${exportQuery}`}><FileDown size={16} /> PDF</a>
          <label className="sortControl">
            <SlidersHorizontal size={16} />
            <select value={pageFilters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
              <option value="deadline_asc">Sıralama: Yakın</option>
              <option value="deadline_desc">Sıralama: Uzak</option>
              <option value="newest">Sıralama: Yeni</option>
            </select>
          </label>
        </div>
      </section>
      <section className="content callsSection">
        <button className="mobileFilterTrigger" type="button" onClick={() => setFiltersOpen(true)}>
          <ListFilter size={18} />
          Filtrele
        </button>
        {filtersOpen && <button className="filterBackdrop" type="button" aria-label="Filtreleri kapat" onClick={() => setFiltersOpen(false)} />}
        <div className={`filterSheet ${filtersOpen ? "open" : ""}`}>
          <button className="sheetClose" type="button" aria-label="Filtreleri kapat" onClick={() => setFiltersOpen(false)}><X size={18} /></button>
          <FilterPanel
            calls={model.calls}
            filters={pageFilters}
            setFilters={setFilters}
            categories={model.categoryList}
            funders={model.funderList}
            targetGroupOptions={model.targetGroupOptions}
            keywordOptions={model.keywordOptions}
            themeOptions={model.themeOptions}
            countryOptions={model.countryOptions}
            currencyOptions={model.currencyOptions}
            refresh={refresh}
            loading={loading}
            fetchedAt={fetchedAt}
            lockedScope={scopeFromRoute}
            resultCount={filtered.length}
          />
        </div>
        <div className="resultsArea">
          <div className="sectionHeader">
            <div>
              <h2>{pageTitle}</h2>
              <p>{pageText}</p>
            </div>
            <div className="health">{errors.length ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{errors.length ? `${errors.length} kaynak uyarısı` : "Kaynaklar aktif"}</div>
          </div>
          <ActiveFilterBar filters={activeFilters} total={model.calls.length} count={filtered.length} onClear={clearFilter} onReset={resetFilters} />
          {loading && !model.calls.length ? <CallCardSkeleton /> : (
            <div className="cardGrid">
              {filtered.map((call) => <CallCard key={call.id} call={call} mode="link" />)}
              {!filtered.length && <EmptyState title="Çağrı bulunamadı" text="Arama ya da filtre seçeneklerini genişleterek tekrar deneyin." />}
            </div>
          )}
        </div>
        <CallsAside calls={filtered} errors={errors} siteContent={siteContent} />
      </section>
    </>
  );
}

function CallDetailPage({ route, model }) {
  const id = decodeURIComponent(route.pathname.replace(/^\/(?:cagrilar|cagri)\//, ""));
  const call = model.calls.find((item) => item.id === id || item.slug === id);
  const [copied, setCopied] = useState(false);
  const seoDescription = call
    ? `${call.programme || call.category || "Proje destek çağrısı"} - ${targetGroups(call).join(", ")} için ${call.supportType || call.category || "destek"}. Son başvuru: ${formatDate(call.deadline)}.`
    : "Proje destek çağrısı detayları.";
  usePageMeta(`${call?.title || "Çağrı Detayı"} | ${call?.funder || "Hibe Rota"} | Proje Destek Çağrıları`, seoDescription);
  useEffect(() => {
    if (!call) return;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: call.title,
      description: compactSummary(call),
      datePublished: call.publishedAt || call.publicationDate,
      dateModified: call.lastVerifiedAt,
      author: { "@type": "Organization", name: call.funder || call.institution || "Hibe Rota" },
      publisher: { "@type": "Organization", name: "Hibe Rota" },
      mainEntityOfPage: window.location.href,
    };
    let script = document.getElementById("call-jsonld");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "call-jsonld";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
    return () => {
      document.getElementById("call-jsonld")?.remove();
    };
  }, [call]);
  if (!call) {
    return <NotFoundPage />;
  }
  const links = calendarLinks(call);
  const similar = similarCallsFor(call, model.calls);
  const closed = isClosedCall(call);
  const shareUrl = `${window.location.origin}${callPath(call)}`;
  const shareText = `${call.title} - Hibe Rota`;
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: call.title, text: shareText, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* user cancelled or clipboard unavailable */ }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };
  const criticalInfo = [
    ["Çağrı kodu", call.callCode || call.externalId],
    ["Program", call.programme || call.category],
    ["Destekleyen kurum", call.institution || call.funder],
    ["Çağrı türü", call.supportType || call.category],
    ["Destek türü", call.support],
    ["Hedef kitle", targetGroups(call).join(", ")],
    ["Başvuru başlangıcı", formatDate(call.openingDate)],
    ["Son başvuru", formatDate(call.deadline)],
    ["Son başvuru saati", call.deadlineTime],
    ["Saat dilimi", call.deadlineTimezone],
    ["Proje süresi", call.projectDuration],
    ["Toplam bütçe", call.budgetMax ? formatBudget(call) : ""],
    ["Destek oranı", call.supportRate ? formatSupportRate(call) : ""],
    ["Başvuru dili", call.language?.toLocaleUpperCase("tr-TR")],
    ["Uygun ülkeler", Array.isArray(call.eligibleCountries) ? call.eligibleCountries.join(", ") : call.eligibleCountries],
  ].filter(([, value]) => value && value !== "Tarih bekleniyor");
  const quickInfo = [
    { label: "Toplam Bütçe", value: formatBudget(call), icon: Banknote },
    { label: "Son Başvuru", value: formatDate(call.deadline), icon: CalendarDays },
    { label: "Açılış Tarihi", value: formatDate(call.openingDate || call.publicationDate || call.publishedAt), icon: Clock3 },
    { label: "Fonlanacak Proje Sayısı", value: call.projectCount || call.fundedProjectCount || call.expectedProjects || "Çağrı metninde belirtilir", icon: ClipboardList },
    { label: "Fonlama Oranı", value: formatSupportRate(call), icon: Target },
  ];
  const statusTone = closed || call.normalizedStatus === "CANCELLED" ? "closed" : callStatusGroup(call) === "open" ? "open" : "upcoming";
  const statusMessage = closed
    ? "Bu çağrı kapanmıştır"
    : callStatusGroup(call) === "open"
      ? `Başvuru kabul ediliyor${call.deadline ? `, son tarih ${formatDate(call.deadline)}` : ""}`
      : "Başvuru tarihi yaklaşıyor";
  return (
    <>
      <Breadcrumb items={[{ label: "Çağrılar", href: "/cagrilar" }, { label: scopeLabel(call.scope), href: `/cagrilar/${scopeToQuery(call.scope) === "international" ? "uluslararasi" : scopeToQuery(call.scope) === "europe" ? "avrupa" : "ulusal"}` }, { label: "Çağrı Detayı" }]} />
      <section className="content callDetailHero">
        <div className="callHeroMain">
          <h1>{cleanHtml(call.title)}</h1>
          <p className="callCodeLine">Çağrı ID: {call.callCode || call.externalId || call.id}</p>
          <div className="callPills">
            <span><ClipboardList size={16} /><strong>Cluster:</strong> {call.programme || call.category}</span>
            <span><Target size={16} /><strong>Destination:</strong> {call.thematicArea || callThemes(call)[0]}</span>
            <span><WalletCards size={16} /><strong>Tip:</strong> {call.supportType || call.category}</span>
            <span><CalendarDays size={16} /><strong>Yıl:</strong> {new Date(call.deadline || call.openingDate || Date.now()).getFullYear()}</span>
          </div>
          <div className={`callStatusNotice ${statusTone}`}>
            {statusTone === "closed" ? <X size={18} /> : <CheckCircle2 size={18} />}
            <strong>{statusMessage}</strong>
          </div>
          <p className="heroSummary">{compactSummary(call)}</p>
          <div className="detailActions">
            {call.officialUrl && <a href={ensureHttp(call.officialUrl)} target="_blank" rel="noopener noreferrer">Resmî Çağrı Metnini Görüntüle <ArrowUpRight size={15} /></a>}
            {call.guideUrl && <a href={ensureHttp(call.guideUrl)} target="_blank" rel="noopener noreferrer">Başvuru Rehberini Görüntüle <ArrowUpRight size={15} /></a>}
            <button type="button" onClick={share}><Share2 size={15} /> Paylaş</button>
          </div>
          {copied && <div className="copyToast" role="status">Bağlantı kopyalandı.</div>}
        </div>
        <aside className="quickInfoPanel" aria-label="Hızlı bilgiler">
          <div className="quickInfoHeader">
            <h2>Hızlı Bilgiler</h2>
            <span className={statusTone}>{statusLabel(call.normalizedStatus || call.status)}</span>
          </div>
          <div className="quickInfoList">
            {quickInfo.map(({ label, value, icon: Icon }) => (
              <div className="quickInfoItem" key={label}>
                <Icon size={22} />
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </div>
            ))}
          </div>
          {!closed && (call.applicationUrl || call.url) && <a className="primaryAction quickApply" href={ensureHttp(call.applicationUrl || call.url)} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={18} /> Başvuru Yap</a>}
          {closed && <span className="closedNotice">Bu çağrının başvuru süresi sona ermiştir.</span>}
          <FavoriteButton callId={call.id} className="favoriteAction" />
        </aside>
      </section>
      <section className="content detailPageGrid">
        <aside className="detailSidebar">
          <div className="institutionLogo"><Landmark size={34} /><span>{(call.funder || "HR").slice(0, 2).toLocaleUpperCase("tr-TR")}</span></div>
          <DetailItem label="Kurum" value={call.institution || call.funder} />
          <DetailItem label="Program" value={call.programme || call.category} />
          <DetailItem label="Kalan Süre" value={urgencyLabel(call)} />
          <DetailItem label="Son Kontrol" value={formatDateTime(call.lastVerifiedAt)} />
          <div className="detailActions sideActions">
            <button type="button" onClick={copyLink}><Copy size={15} /> Bağlantıyı Kopyala</button>
          </div>
        </aside>
        <div className="detailContent">
          <section className="detailBlock">
            <h2>Çağrı Özeti</h2>
            <p className="leadText">{compactSummary(call)}</p>
          </section>
          <section className="detailBlock">
            <h2>Çağrının Amacı</h2>
            <p className="leadText">{cleanHtml(call.purpose || call.description || call.summary || "Bu çağrı, resmî kaynakta belirtilen kapsamda proje, araştırma veya iş birliği faaliyetlerini desteklemeyi amaçlar.")}</p>
          </section>
          {!!callBenefits(call).length && <section className="detailBlock">
            <h2>Program Ne Sağlıyor?</h2>
            <div className="benefitGrid">
              {callBenefits(call).map(({ title, description, icon: Icon = Sparkles }) => <article key={title}><Icon size={20} /><strong>{title}</strong>{description && <p>{description}</p>}</article>)}
            </div>
          </section>}
          {!!callThemes(call).length && <section className="detailBlock">
            <h2>Tematik Alanlar</h2>
            <div className="tagCloud">{callThemes(call).map((theme) => <span key={theme}>{theme}</span>)}</div>
          </section>}
          <section className="detailBlock">
            <h2>Kimler Başvurabilir?</h2>
            <div className="tagCloud audienceTags">{targetGroups(call).map((group) => <span key={group}><Users size={14} /> {group}</span>)}</div>
          </section>
          <section className="detailBlock">
            <h2>Uygunluk Kriterleri</h2>
            <ul className="cleanList">{eligibilityItems(call).map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="detailBlock">
            <h2>Destek Kapsamı ve Bütçe</h2>
            <div className="detailGrid">
              <DetailItem label="Destek miktarı" value={formatBudget(call)} />
              <DetailItem label="Para birimi" value={currencyLabel(call.currency)} />
              <DetailItem label="Destek oranı" value={formatSupportRate(call)} />
              <DetailItem label="Proje süresi" value={call.projectDuration} />
            </div>
          </section>
          <section className="detailBlock">
            <h2>Otomasyonun Doldurduğu Ana Alanlar</h2>
            <div className="detailGrid">
              {criticalInfo.map(([label, value]) => <DetailItem key={label} label={label} value={value} />)}
            </div>
          </section>
          <section className="detailBlock">
            <h2>Başvuru Süreci</h2>
            <div className="timelineList">
              {applicationSteps(call).map((step) => <article key={`${step.order}-${step.title}`}><span>{step.order}</span><div><strong>{step.title}</strong>{step.description && <p>{step.description}</p>}</div></article>)}
            </div>
          </section>
          <section className="detailBlock">
            <h2>Gerekli Belgeler</h2>
            <div className="documentList">
              {requiredDocuments(call).map((doc) => <article key={doc.name}><FileText size={18} /><div><strong>{doc.name}</strong><span>{doc.required ? "Zorunlu" : "Çağrı koşullarına bağlı"}</span>{doc.description && <p>{doc.description}</p>}</div>{doc.templateUrl && <a href={ensureHttp(doc.templateUrl)} target="_blank" rel="noopener noreferrer">Şablon</a>}</article>)}
            </div>
          </section>
          <section className="detailBlock">
            <h2>Değerlendirme Süreci</h2>
            <div className="stepGrid">
              {["İdari uygunluk kontrolü", "Bilimsel/teknik değerlendirme", "Bütçe ve etki değerlendirmesi", "Nihai karar ve sözleşme"].map((title) => <InfoStep key={title} title={title} text="Aşamanın ayrıntıları resmî çağrı dokümanında belirtilir." />)}
            </div>
          </section>
          <section className="detailBlock">
            <h2>Önemli Tarihler</h2>
            <div className="dateTimeline">
              {importantTimeline(call).map((item) => <article key={`${item.title}-${item.date}`}><span>{new Date(item.date).getTime() < Date.now() ? "Geçmiş" : "Yaklaşan"}</span><strong>{item.title}</strong><time>{formatDate(item.date)}</time>{item.description && <p>{item.description}</p>}</article>)}
              {!importantTimeline(call).length && <p className="mutedText">Resmî kaynakta yapılandırılmış tarih bilgisi bulunamadı.</p>}
            </div>
          </section>
          <section className="detailBlock">
            <h2>Resmî Belgeler ve Bağlantılar</h2>
            <div className="detailActions">
              {call.officialUrl && <a className="primaryAction" href={ensureHttp(call.officialUrl)} target="_blank" rel="noopener noreferrer">Resmî Kaynak <ArrowUpRight size={15} /></a>}
              {call.guideUrl && <a href={ensureHttp(call.guideUrl)} target="_blank" rel="noopener noreferrer">Başvuru Rehberi <ArrowUpRight size={15} /></a>}
              <a href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar</a>
              <a href={links.outlook} target="_blank" rel="noopener noreferrer">Outlook</a>
              <a href={links.ics}>ICS indir</a>
            </div>
          </section>
          <section className="detailBlock">
            <h2>İletişim Bilgileri</h2>
            <div className="contactCard">
              <DetailItem label="Kurum" value={call.institution || call.funder} />
              {call.contacts?.map((contact, index) => <div key={index} className="contactLinks">{contact.email && <a href={`mailto:${contact.email}`}><Mail size={15} /> {contact.email}</a>}{contact.phone && <a href={`tel:${contact.phone}`}><MessageCircle size={15} /> {contact.phone}</a>}{contact.website && <a href={ensureHttp(contact.website)} target="_blank" rel="noopener noreferrer">Web sitesi</a>}</div>)}
              {!call.contacts?.length && <p className="mutedText">İletişim bilgileri için resmî çağrı sayfasını kontrol edin.</p>}
            </div>
          </section>
          <section className="detailBlock">
            <h2>Kaynak ve Doğrulama</h2>
            <div className="detailGrid">
              <DetailItem label="Kaynak kurum" value={call.funder || call.institution} />
              <DetailItem label="Kaynak sayfa" value={call.source} />
              <DetailItem label="Son kontrol" value={formatDateTime(call.lastVerifiedAt)} />
              <DetailItem label="Doğrulama durumu" value={verificationLabel(call)} />
              <DetailItem label="İçerik referansı" value={call.contentHash ? `${call.contentHash.slice(0, 12)}...` : ""} />
            </div>
          </section>
          <section className="detailBlock">
            <h2>Paylaş</h2>
            <div className="shareGrid">
              <button type="button" onClick={share}><Share2 size={16} /> Sistem paylaşımı</button>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">X</a>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <a href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`}>E-posta</a>
              <button type="button" onClick={copyLink}><Copy size={16} /> Bağlantıyı kopyala</button>
            </div>
          </section>
        </div>
      </section>
      <section className="content relatedSection">
        <SectionTitle eyebrow="Benzer çağrılar" title="Benzer Fırsatlar" text="Kapsam, kategori veya kurum benzerliğine göre seçildi." />
        <div className="cardGrid">
          {similar.map((item) => <CallCard key={item.id} call={item} mode="link" />)}
          {!similar.length && <EmptyState title="Benzer çağrı yok" text="Bu çağrı için yeterli benzer kayıt bulunamadı." />}
        </div>
      </section>
    </>
  );
}

function InfoStep({ title, text }) {
  return <article><strong>{title}</strong><p>{text}</p></article>;
}

function targetAudience(call) {
  if (/kobi|sanayi|işletme|company|sme/i.test(`${call.title} ${call.summary}`)) return "KOBİ, şirketler ve sanayi kuruluşları";
  if (/üniversite|akadem|research|araştır/i.test(`${call.title} ${call.summary}`)) return "Araştırmacılar, akademisyenler ve araştırma kurumları";
  return "Çağrı koşullarına uygun araştırma, girişim ve kurum ekipleri";
}

function compactSummary(call) {
  const raw = call.summary || call.description || call.category || "";
  const clean = String(raw).replace(/\s+/g, " ").trim();
  if (clean.length >= 260) return `${clean.slice(0, 520).replace(/\s+\S*$/, "")}.`;
  const deadline = call.deadline ? ` Son başvuru tarihi ${formatDate(call.deadline)}.` : "";
  return `${clean || `${call.programme || call.category || "Program"} kapsamında proje ve araştırma başvuruları desteklenir.`}${deadline}`.trim();
}

function callThemes(call) {
  const values = [
    ...(call.categories || []),
    call.category,
    call.programme,
    ...String(call.title || "").split(/[:–-]/).slice(0, 1),
  ];
  const normalized = [...new Set(values.map((item) => String(item || "").trim()).filter((item) => item && item.length <= 80))];
  return normalized.slice(0, 10);
}

function targetGroups(call) {
  const explicit = Array.isArray(call.targetAudience) ? call.targetAudience : call.targetAudience ? [call.targetAudience] : [];
  if (explicit.length) return explicit;
  const text = [
    call.title,
    call.summary,
    call.category,
    call.programme,
    call.supportType,
    ...(call.eligibleInstitutions || []),
  ].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
  const groups = [];
  if (/öğrenci|student|doctoral|doktora/.test(text)) groups.push("Öğrenciler ve doktora araştırmacıları");
  if (/akadem|üniversite|university|researcher|araştırmac/.test(text)) groups.push("Akademisyenler ve araştırmacılar");
  if (/kobi|sme|firma|şirket|company|startup|girişim/.test(text)) groups.push("KOBİ'ler, girişimler ve şirketler");
  if (/kamu|belediye|public/.test(text)) groups.push("Kamu kurumları ve yerel yönetimler");
  if (/ngo|stk|dernek|vakıf|nonprofit/.test(text)) groups.push("STK'lar ve sosyal girişimler");
  return groups.length ? groups : [targetAudience(call)];
}

function audienceChipLabels(call) {
  const rawGroups = [
    ...targetGroups(call),
    ...(Array.isArray(call.eligibleInstitutions) ? call.eligibleInstitutions : [call.eligibleInstitutions]),
    call.eligibleApplicants,
    call.target_audience,
    call.eligible_applicants,
  ].filter(Boolean);
  const text = normalizeSearch(rawGroups.join(" "));
  const labels = [];
  const add = (label, pattern) => {
    if (pattern.test(text) && !labels.includes(label)) labels.push(label);
  };

  add("Öğrenci", /ogrenci|student|lisans|graduate|undergraduate/);
  add("Akademisyen", /akadem|academ/);
  add("Araştırmacı", /arastirmaci|researcher|research|postdoc|doktora|doctoral/);
  add("Şirket / KOBİ", /kobi|sme|firma|sirket|company|startup|girisim|sanayi|isletme|industry/);
  add("Kurum / Kuruluş", /kurum|kurulus|institution|universite|university|kamu|belediye|oda|tto|teknopark|stk|altyapi/);
  add("Sağlık Profesyoneli", /doktor|doctor|clinical|klinik|saglik/);

  if (labels.length) return labels;
  return rawGroups
    .map((group) => cleanHtml(group).replace(/\s+ve\s+/gi, ", "))
    .flatMap((group) => group.split(/[,;/+]/))
    .map((group) => group.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function callBenefits(call) {
  if (call.benefits?.length) return call.benefits;
  const text = `${call.title} ${call.summary} ${call.support} ${call.category}`.toLocaleLowerCase("tr-TR");
  const benefits = [];
  if (call.support && !/belirtilir|doküman/.test(call.support)) benefits.push({ title: "Finansal destek", description: call.support, icon: Banknote });
  if (/seyahat|travel/.test(text)) benefits.push({ title: "Seyahat desteği", description: "Program koşulları kapsamında hareketlilik ve iş birliği giderleri desteklenebilir.", icon: Globe2 });
  if (/araştırma|research|infrastructure|altyap/.test(text)) benefits.push({ title: "Araştırma imkânı", description: "Araştırma, geliştirme veya bilimsel iş birliği faaliyetleri desteklenir.", icon: Target });
  if (/konsorsiyum|ortak|iş birliği|partnership|network/.test(text)) benefits.push({ title: "Uluslararası iş birliği", description: "Ortak kurumlarla proje geliştirme ve ağ oluşturma imkânı sağlar.", icon: Users });
  return benefits.slice(0, 6);
}

function eligibilityItems(call) {
  if (call.eligibility?.length) return call.eligibility;
  if (call.eligibilityCriteria?.length) return call.eligibilityCriteria;
  return [
    `${scopeLabel(call.scope)} kapsamdaki uygun başvuru sahipleri başvurabilir.`,
    "Başvuru öncesinde resmî çağrı metnindeki kurum, ülke ve ortaklık şartları kontrol edilmelidir.",
  ];
}

function applicationSteps(call) {
  if (call.applicationSteps?.length) return call.applicationSteps.map((step, index) => ({ order: step.order || index + 1, title: step.title || step, description: step.description || "" }));
  return [
    { order: 1, title: "Resmî çağrı metnini inceleyin" },
    { order: 2, title: "Uygunluk koşullarını kontrol edin" },
    { order: 3, title: "Proje ekibini ve ortakları belirleyin" },
    { order: 4, title: "Gerekli belgeleri hazırlayın" },
    { order: 5, title: "Başvuruyu resmî sistem üzerinden tamamlayın" },
  ];
}

function requiredDocuments(call) {
  if (call.requiredDocuments?.length) return call.requiredDocuments;
  return [
    { name: "Proje önerisi", required: true, description: "Resmî çağrı formatına göre hazırlanır." },
    { name: "Bütçe gerekçesi", required: true, description: "Destek kapsamındaki giderlerin gerekçesini açıklar." },
    { name: "Ortaklık veya kurum belgeleri", required: false, description: "Çağrı koşullarına bağlıdır." },
  ];
}

function importantTimeline(call) {
  const items = [];
  if (call.publicationDate || call.publishedAt) items.push({ title: "Yayımlanma", date: call.publicationDate || call.publishedAt });
  if (call.openingDate) items.push({ title: "Başvuru başlangıcı", date: call.openingDate });
  (call.importantDates || []).forEach((item) => items.push({ title: item.title || item.type || "Önemli tarih", date: item.date, description: item.rawText || item.description, timezone: item.timezone }));
  if (call.deadline) items.push({ title: "Son başvuru", date: call.deadline, description: call.evidence?.deadline?.rawText, timezone: call.deadlineTimezone });
  return items.filter((item) => item.date).slice(0, 8);
}

function isClosedCall(call) {
  return callStatusGroup(call) === "closed" || daysLeft(call.deadline) < 0;
}

function similarCallsFor(call, calls) {
  return calls
    .filter((item) => item.id !== call.id)
    .map((item) => {
      let score = 0;
      if (callStatusGroup(item) === "open") score += 8;
      if (item.scope === call.scope) score += 5;
      if (item.funder === call.funder) score += 4;
      if (item.category === call.category) score += 4;
      if ((item.categories || []).some((category) => (call.categories || []).includes(category))) score += 3;
      if (targetGroups(item).some((group) => targetGroups(call).includes(group))) score += 2;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || deadlineTime(a.item) - deadlineTime(b.item))
    .slice(0, 4)
    .map(({ item }) => item);
}

function verificationLabel(call) {
  if (call.requiresManualReview) return "Kontrol bekliyor";
  if ((call.confidenceScore || 0) >= 75) return "Resmî kaynaktan doğrulandı";
  return "Kaynak bilgisi otomatik kontrol edildi";
}

function ProgrammesPage({ model }) {
  usePageMeta("Destek Programları | Hibe Rota", "Katalog ve canlı kaynaklardan gelen destek programı alanlarını inceleyin.");
  return (
    <>
      <Breadcrumb items={[{ label: "Destek Programları" }]} />
      <PageHero eyebrow="Katalog" title="Destek Programları" text="Excel kataloğu ve canlı çağrı kategorileri birlikte özetlenir." />
      <section className="content programmeGrid pageGrid">
        <article><Database size={26} /><strong>{catalogData.catalog.length} kayıtlı program</strong><p>Katalogdaki destek başlıkları canlı çağrılarla birlikte değerlendirilir.</p></article>
        {model.categories.map(([category, count]) => (
          <article key={category}><WalletCards size={26} /><strong>{category}</strong><p>{count} açık çağrı bu alanda listeleniyor.</p><a href={`/cagrilar?category=${encodeURIComponent(category)}`} onClick={(event) => { event.preventDefault(); navigate(`/cagrilar?category=${encodeURIComponent(category)}`); }}>Çağrıları Gör</a></article>
        ))}
      </section>
    </>
  );
}

function FundersPage({ model }) {
  usePageMeta("Kurumlar | Hibe Rota", "Aktif fon sağlayıcılarını ve kurum bazlı açık çağrı sayılarını görüntüleyin.");
  return (
    <>
      <Breadcrumb items={[{ label: "Kurumlar" }]} />
      <PageHero eyebrow="Kurumlar" title="Aktif Fon Sağlayıcıları" text="Canlı taramada bulunan fon sağlayıcı kurumlar." />
      <section className="content funderGrid pageGrid">
        {model.funders.map(([funder, count]) => (
          <a key={funder} href={`/cagrilar?funder=${encodeURIComponent(funder)}&scope=${scopeToQuery(inferScopeFromFunder(funder, model.calls) || "Tümü")}`} onClick={(event) => {
            event.preventDefault();
            navigate(`/cagrilar?funder=${encodeURIComponent(funder)}&scope=${scopeToQuery(inferScopeFromFunder(funder, model.calls) || "Tümü")}`);
          }}>
            <Building2 size={22} />
            <strong>{funder}</strong>
            <span>{count} açık çağrı</span>
          </a>
        ))}
      </section>
    </>
  );
}

function ProgrammeDetailPage({ route, model }) {
  const slugValue = decodeURIComponent(route.pathname.replace("/program/", ""));
  const category = model.categoryList.find((item) => normalizeSearch(item).replace(/\s+/g, "-") === slugValue) || slugValue;
  const calls = model.calls.filter((call) => call.programme === category || call.category === category);
  usePageMeta(`${category} | Hibe Rota`, `${category} programına ait açık çağrıları inceleyin.`);
  return (
    <>
      <Breadcrumb items={[{ label: "Destek Programları", href: "/programlar" }, { label: category }]} />
      <PageHero eyebrow="Program" title={category} text={`${calls.length} çağrı bu program veya kategori altında listeleniyor.`} />
      <section className="content cardGrid">
        {calls.map((call) => <CallCard key={call.id} call={call} mode="link" />)}
        {!calls.length && <EmptyState title="Program çağrısı bulunamadı" text="Bu program için canlı kaynaklarda açık çağrı yakalanmadı." />}
      </section>
    </>
  );
}

function FunderDetailPage({ route, model }) {
  const slugValue = decodeURIComponent(route.pathname.replace("/kurum/", ""));
  const funder = model.funderList.find((item) => normalizeSearch(item).replace(/\s+/g, "-") === slugValue) || slugValue;
  const calls = model.calls.filter((call) => call.funder === funder || call.institution === funder);
  usePageMeta(`${funder} | Hibe Rota`, `${funder} tarafından yayımlanan destek çağrılarını inceleyin.`);
  return (
    <>
      <Breadcrumb items={[{ label: "Kurumlar", href: "/kurumlar" }, { label: funder }]} />
      <PageHero eyebrow="Kurum" title={funder} text={`${calls.length} canlı çağrı bu kurumla ilişkilendirildi.`} />
      <section className="content cardGrid">
        {calls.map((call) => <CallCard key={call.id} call={call} mode="link" />)}
        {!calls.length && <EmptyState title="Kurum çağrısı bulunamadı" text="Bu kurum için canlı kaynaklarda açık çağrı yakalanmadı." />}
      </section>
    </>
  );
}

function CalendarPage({ model }) {
  usePageMeta("Çağrı Takvimi | Hibe Rota", "Yaklaşan proje destek son başvuru tarihlerini takip edin.");
  return (
    <>
      <Breadcrumb items={[{ label: "Çağrı Takvimi" }]} />
      <PageHero eyebrow="Takvim" title="Çağrı Takvimi" text="Yaklaşan son başvuru tarihlerini liste görünümünde takip edin." />
      <CalendarSection urgent={model.urgent} />
    </>
  );
}

function CalendarSection({ urgent }) {
  return (
    <section className="content calendarSection">
      <div className="calendarHeader">
        <SectionTitle eyebrow="Son tarihler" title={monthLabel()} text="Açık çağrılardan yaklaşan son başvuru tarihleri." />
        <div className="calendarModes" aria-label="Takvim görünümü"><button type="button" className="active">Aylık</button><button type="button">Haftalık</button><button type="button">Liste</button></div>
      </div>
      <div className="calendarBoard">
        <aside>
          <h3>Filtreler</h3><label><input type="checkbox" defaultChecked /> TÜBİTAK</label><label><input type="checkbox" defaultChecked /> Avrupa</label><label><input type="checkbox" defaultChecked /> Uluslararası</label>
        </aside>
        <div className="calendarList">
          <div className="calendarMonth"><CalendarDays size={22} /><strong>{monthLabel()}</strong></div>
          {urgent.slice(0, 20).map((call) => (
            <a key={call.id} className="calendarRow" href={callPath(call)} onClick={(event) => { event.preventDefault(); navigate(callPath(call)); }}>
              <span>{formatDate(call.deadline)}</span><strong>{cleanHtml(call.title)}</strong><em>{urgencyLabel(call)}</em>
            </a>
          ))}
          {!urgent.length && <p className="emptyInline">Takvimde yaklaşan çağrı bulunamadı.</p>}
        </div>
      </div>
    </section>
  );
}

function GuidePage({ siteContent }) {
  usePageMeta("Proje Rehberi | Hibe Rota", "Proje başvurusu hazırlamak için çağrı okuma, bütçe, ortaklık ve yazım rehberi.");
  return (
    <>
      <Breadcrumb items={[{ label: "Proje Rehberi" }]} />
      <section className="content guideSection">
        <GuideContent siteContent={siteContent} />
      </section>
    </>
  );
}

function GuideArticlePage({ route, siteContent }) {
  const slug = decodeURIComponent(route.pathname.replace("/rehber/", ""));
  const articles = siteContent.guide.articles;
  const article = articles.find((card) => card.slug === slug);
  usePageMeta(`${article?.title || "Rehber Yazısı"} | Hibe Rota`, article?.text || "Proje başvuru rehberi makalesi.");
  if (!article) return <NotFoundPage />;
  const related = articles.filter((card) => card.slug !== article.slug).slice(0, 3);
  return (
    <>
      <Breadcrumb items={[{ label: "Proje Rehberi", href: "/rehber" }, { label: article.title }]} />
      <article className="content articlePage">
        <header className="articleHeader">
          <span>{article.tag}</span>
          <h1>{article.title}</h1>
          <p>{article.text}</p>
          <div><Clock3 size={16} /> {article.time} okuma</div>
          {article.coverImage && <img className="articleCoverImage" src={article.coverImage} alt="" aria-hidden="true" />}
        </header>
        <div className="articleLayout">
          <aside className="articleToc" aria-label="Makale içindekiler">
            <strong>İçindekiler</strong>
            {article.sections.map((section) => (
              <a key={section.title} href={`#${normalizeSearch(section.title).replace(/\s+/g, "-")}`}>{section.title}</a>
            ))}
          </aside>
          <div className="articleBody">
            {article.sections.map((section) => (
              <section key={section.title} id={normalizeSearch(section.title).replace(/\s+/g, "-")}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}
            <div className="articleNote">
              <strong>Uygulama önerisi</strong>
              <p>Bu rehberi okuduktan sonra ilgili çağrı sayfasını açıp başlık, uygunluk, bütçe ve son tarih alanlarını yan yana kontrol edin.</p>
              <a className="primaryAction" href="/cagrilar" onClick={(event) => {
                event.preventDefault();
                navigate("/cagrilar");
              }}>Çağrıları Gör <ArrowRight size={15} /></a>
            </div>
          </div>
        </div>
      </article>
      <section className="content relatedSection">
        <SectionTitle eyebrow="Diğer rehberler" title="Okumaya Devam Edin" text="Başvuru hazırlığını tamamlamak için ilgili rehberler." />
        <div className="guideCards">
          {related.map((card) => <GuideCard key={card.slug} card={card} />)}
        </div>
      </section>
    </>
  );
}

function GuideCard({ card }) {
  return (
    <article>
      <div><span>{card.tag}</span><em><Clock3 size={14} /> {card.time}</em></div>
      <h2>{card.title}</h2>
      <p>{card.text}</p>
      <a href={`/rehber/${card.slug}`} onClick={(event) => {
        event.preventDefault();
        navigate(`/rehber/${card.slug}`);
      }}>Kılavuzu Oku <ArrowRight size={15} /></a>
    </article>
  );
}

function GuideContent({ siteContent }) {
  const articles = siteContent.guide.articles;
  return (
    <>
      <div className="guideHero">
        <h1>{siteContent.guide.heroTitle}</h1>
        <p>{siteContent.guide.heroText}</p>
        <label><Search size={21} /><input placeholder="Rehberde arayın: bütçe, TRL, ortaklık..." aria-label="Rehberde ara" /></label>
      </div>
      <div className="guideLayout">
        <div className="guideSidebar">
          <nav aria-label="Rehber kategorileri">{siteContent.guide.categories.map((item, index) => <a key={item} className={index === 0 ? "active" : ""} href="/rehber">{item}</a>)}</nav>
        </div>
        <div className="guideCards">
          {articles.map((card) => (
            <GuideCard key={card.slug} card={card} />
          ))}
        </div>
      </div>
      <div className="glossary">
        <h2><BookOpen size={27} /> Proje Terimleri Sözlüğü</h2>
        <div>{siteContent.guide.glossary.map((item) => <p key={item.term}><strong>{item.term}</strong> {item.definition}</p>)}</div>
      </div>
    </>
  );
}

function ContactPage() {
  usePageMeta("İletişim | Hibe Rota", "Platformla ilgili geri bildirim ve kurumsal iletişim için bize ulaşın.");
  return (
    <>
      <Breadcrumb items={[{ label: "İletişim" }]} />
      <PageHero eyebrow="Kurumsal" title="İletişim" text="Platformla ilgili geri bildirim, kaynak önerisi ve kurumsal iletişim için bizimle paylaşım yapabilirsiniz." />
      
      <section className="content" style={{ padding: "40px 24px", maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          
          <div className="card" style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "16px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={32} />
            </div>
            <h3 style={{ margin: "8px 0 0", fontSize: "1.25rem", color: "var(--text)" }}>Bize Ulaşın</h3>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
              Her türlü soru, görüş ve destek talebiniz için e-posta adresimiz üzerinden bizimle iletişime geçebilirsiniz.
            </p>
            <a href="mailto:veordijital@gmail.com" className="primaryButton" style={{ marginTop: "8px" }}>
              veordijital@gmail.com
            </a>
          </div>

          <div className="card" style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "16px", background: "linear-gradient(135deg, var(--primary-panel), #0f172a)", color: "#fff", border: "none" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe2 size={32} />
            </div>
            <h3 style={{ margin: "8px 0 0", fontSize: "1.25rem", color: "#fff" }}>Markamız</h3>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
              Bu web site <strong>Veor Collection</strong> markasının bir ürünüdür. Ürünlerimizi ve projelerimizi incelemek için web sitemizi ziyaret edin.
            </p>
            <a href="https://www.veorcollection.com" target="_blank" rel="noopener noreferrer" className="primaryButton" style={{ marginTop: "8px", background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
              www.veorcollection.com
            </a>
          </div>

        </div>
      </section>
    </>
  );
}

function PrivacyPolicyPage() {
  usePageMeta(
    "Gizlilik Politikası | Hibe Rota",
    "Hibe Rota web sitesinin KVKK, GDPR ve genel uluslararası veri koruma ilkeleri doğrultusunda hazırlanan gizlilik politikası.",
  );

  const updatedAt = "18 Haziran 2026";
  const sections = [
    {
      title: "1. Amaç ve kapsam",
      body: [
        "Bu Gizlilik Politikası, Hibe Rota web sitesini ziyaret eden kullanıcıların kişisel verilerinin hangi ilkelerle işlendiğini açıklamak için hazırlanmıştır.",
        "Hibe Rota, üyelik veya kullanıcı profili gerektirmeyen; ulusal, Avrupa ve uluslararası hibe/çağrı bilgilerini kamuya açık kaynaklardan derleyen bir bilgilendirme platformudur.",
      ],
    },
    {
      title: "2. Veri sorumlusu ve iletişim",
      body: [
        "Bu web sitesi Veor Collection markası tarafından sunulan Hibe Rota hizmetidir. Gizlilik ve veri koruma talepleri için iletişim adresi: veordijital@gmail.com.",
        "Bu politika, veri sorumlusunun KVKK kapsamındaki aydınlatma yükümlülüğü ve GDPR kapsamındaki şeffaf bilgilendirme ilkeleri dikkate alınarak hazırlanmıştır.",
      ],
    },
    {
      title: "3. İşlenen veri kategorileri",
      body: [
        "Hibe Rota kullanıcı hesabı, parola, profil, ödeme bilgisi veya özel nitelikli kişisel veri toplamaz.",
        "Web sitesinin güvenli ve düzgün çalışması için IP adresi, tarayıcı/cihaz bilgisi, erişim zamanı, talep edilen sayfa, hata kayıtları ve güvenlik logları gibi teknik veriler sınırlı şekilde işlenebilir.",
        "Kullanıcının arama ve filtre tercihleri kalıcı profil oluşturmak için değil, sayfa URL parametreleri ve tarayıcı deneyimi içinde kullanılır.",
        "E-posta yoluyla bizimle iletişime geçerseniz, ileti içeriğinde paylaştığınız ad-soyad, e-posta adresi ve mesaj içeriği yalnızca talebinizi yanıtlamak için işlenir.",
      ],
    },
    {
      title: "4. İşleme amaçları",
      body: [
        "Siteyi yayınlamak, çağrı listesini göstermek, arama/filtreleme/export/RSS/takvim özelliklerini çalıştırmak.",
        "Hizmet güvenliğini sağlamak, kötüye kullanımı ve yetkisiz admin erişimini önlemek, hata ayıklama ve performans iyileştirmesi yapmak.",
        "Kullanıcı taleplerine yanıt vermek ve yasal yükümlülüklere uymak.",
        "Kamuya açık hibe çağrısı kaynaklarını izleyerek başvuru ekiplerine güncel bilgilendirme sunmak.",
      ],
    },
    {
      title: "5. Hukuki sebepler",
      body: [
        "KVKK bakımından teknik loglar ve güvenlik kayıtları; bir hakkın tesisi, kullanılması veya korunması, veri sorumlusunun meşru menfaati ve hukuki yükümlülüklerin yerine getirilmesi kapsamında işlenebilir.",
        "İletişim talepleri, talebinize cevap verilebilmesi için meşru menfaat veya sözleşme öncesi iletişim kapsamında işlenebilir.",
        "GDPR bakımından uygulanabilir olduğu ölçüde işlemeler; meşru menfaat, hukuki yükümlülük ve kullanıcının talebine bağlı iletişim dayanaklarına dayanır.",
      ],
    },
    {
      title: "6. Çerezler ve benzer teknolojiler",
      body: [
        "Hibe Rota, temel site işlevleri, güvenlik, favori/tercih gibi yerel tarayıcı özellikleri ve performans için zorunlu veya işlevsel teknolojiler kullanabilir.",
        "Zorunlu çerezler ve yerel depolama kayıtları siteyi çalıştırmak için kullanılır. Pazarlama, davranışsal reklam veya üçüncü taraf takip çerezi kullanılacak olursa önceden açık bilgilendirme ve gerekli hallerde rıza mekanizması sağlanır.",
        "Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz; ancak bazı site özellikleri sınırlı çalışabilir.",
      ],
    },
    {
      title: "7. Verilerin aktarılması",
      body: [
        "Kişisel veriler satılmaz, kiralanmaz veya reklam amaçlı üçüncü taraflarla paylaşılmaz.",
        "Teknik barındırma, güvenlik, loglama, e-posta iletişimi veya hukuki yükümlülükler için hizmet alınan altyapı sağlayıcılarıyla sınırlı paylaşım yapılabilir.",
        "Uluslararası veri aktarımı gerekirse KVKK, GDPR ve ilgili mevzuatta öngörülen güvenli aktarım mekanizmaları dikkate alınır.",
      ],
    },
    {
      title: "8. Saklama süreleri",
      body: [
        "Teknik loglar güvenlik, hata analizi ve yasal yükümlülükler için gerekli süre boyunca saklanır; ihtiyaç ortadan kalktığında silinir, anonimleştirilir veya mevzuata uygun şekilde imha edilir.",
        "İletişim e-postaları, talebin yanıtlanması ve olası uyuşmazlıkların yönetimi için makul süreyle saklanır.",
        "Kamuya açık hibe çağrısı verileri kişisel veri niteliğinde değilse çağrı geçmişi ve değişiklik takibi amacıyla tutulabilir.",
      ],
    },
    {
      title: "9. Güvenlik önlemleri",
      body: [
        "Admin işlemleri public arayüzden ayrıdır ve yetkisiz erişimi önlemek için kimlik doğrulama, rate limit, güvenlik başlıkları, URL güvenliği, log maskeleme ve düzenli audit kontrolleri uygulanır.",
        "Veri işleme faaliyetleri veri minimizasyonu, amaçla sınırlılık, erişim kontrolü ve güncel güvenlik yamaları ilkeleriyle yürütülür.",
      ],
    },
    {
      title: "10. İlgili kişi hakları",
      body: [
        "KVKK madde 11 ve uygulanabilir olduğunda GDPR kapsamındaki haklarınız doğrultusunda; kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme, işlemeyi kısıtlama, itiraz etme ve mevzuatta öngörülen diğer hakları kullanma imkanınız bulunur.",
        "Taleplerinizi veordijital@gmail.com adresine iletebilirsiniz. Talebiniz, yürürlükteki mevzuatta öngörülen süreler ve kimlik doğrulama gereklilikleri dikkate alınarak değerlendirilir.",
      ],
    },
    {
      title: "11. Üçüncü taraf bağlantılar",
      body: [
        "Hibe Rota, TÜBİTAK, Avrupa Komisyonu, Eureka, Grants.gov ve benzeri resmi veya açık kaynaklara bağlantılar içerebilir.",
        "Bu üçüncü taraf sitelerin gizlilik uygulamaları Hibe Rota’nın kontrolünde değildir. Başvuru yapmadan veya veri paylaşmadan önce ilgili resmi kaynağın gizlilik ve kullanım koşullarını incelemeniz önerilir.",
      ],
    },
    {
      title: "12. Politika değişiklikleri",
      body: [
        "Bu politika mevzuat, hizmet kapsamı veya teknik altyapı değişikliklerine göre güncellenebilir. Güncel sürüm bu sayfada yayımlandığı anda geçerli olur.",
      ],
    },
  ];

  return (
    <>
      <Breadcrumb items={[{ label: "Gizlilik Politikası" }]} />
      <PageHero
        eyebrow="KVKK ve GDPR uyumlu bilgilendirme"
        title="Gizlilik Politikası"
        text="Hibe Rota'nın public, üyelik gerektirmeyen yapısında hangi verilerin hangi amaçlarla işlendiğini ve haklarınızı açıklar."
      />
      <section className="content staticContent privacyPolicy">
        <article>
          <p><strong>Son güncelleme:</strong> {updatedAt}</p>
          <p>
            Bu metin, Hibe Rota web sitesinin mevcut teknik işleyişi esas alınarak hazırlanmış genel gizlilik politikasıdır. Kurumsal unvan, adres, KEP/e-posta veya özel veri işleme süreçleri değişirse bu sayfa güncellenmelidir.
          </p>
        </article>
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </article>
        ))}
        <article>
          <h2>Dayanak alınan temel düzenlemeler</h2>
          <ul>
            <li>6698 sayılı Kişisel Verilerin Korunması Kanunu ve KVKK aydınlatma yükümlülüğü ilkeleri.</li>
            <li>KVKK Çerez Uygulamaları Hakkında Rehber ilkeleri.</li>
            <li>Avrupa Birliği Genel Veri Koruma Tüzüğü (GDPR) şeffaflık, veri minimizasyonu, amaçla sınırlılık ve ilgili kişi hakları ilkeleri.</li>
          </ul>
        </article>
      </section>
    </>
  );
}

function StaticPage({ type }) {
  const pages = {
    "/hakkimizda": ["Hakkımızda", "Hibe Rota, ulusal ve uluslararası destek çağrılarını tek noktada izlenebilir hale getiren üyelik gerektirmeyen bir bilgilendirme platformudur.", "Canlı kaynak taraması, export, RSS ve takvim çıktılarıyla başvuru ekiplerinin güncel fırsatları kaçırmamasını hedefler."],
    "/sss": ["Sıkça Sorulan Sorular", "Veriler nereden geliyor?", "Çağrılar TÜBİTAK, Avrupa ve uluslararası açık kaynaklardan saatlik cache düzeniyle yenilenir."],
    "/kullanim-kosullari": ["Kullanım Koşulları", "Portal bilgilendirme amacıyla sunulur.", "Başvuru öncesinde her çağrının resmi kaynak sayfasındaki güncel koşullar kontrol edilmelidir."],
  };
  const [title, text, extra] = pages[type] || pages["/hakkimizda"];
  usePageMeta(`${title} | Hibe Rota`, text);
  return (
    <>
      <Breadcrumb items={[{ label: title }]} />
      <PageHero eyebrow="Kurumsal" title={title} text={text} />
      <section className="content staticContent">
        <article><p>{extra}</p><p>Bu sayfa mevcut web sitesindeki gerçek içerik ve işlevler temel alınarak oluşturulmuştur; üyelik, yönetim paneli veya haber modülü eklenmemiştir.</p></article>
      </section>
    </>
  );
}

function slugifyText(value) {
  return cleanHtml(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AdminPage({ model, errors, fetchedAt, siteContent, onContentSaved }) {
  usePageMeta("Admin Paneli | Hibe Rota", "Site içerikleri, görseller, proje rehberi yazıları ve otomasyon yönetimi.");
  const openCalls = model.openCalls.length;
  const manualReview = model.calls.filter((call) => call.requiresManualReview).length;
  const lowConfidence = model.calls.filter((call) => (call.confidenceScore || 0) < 75).length;
  const [activeTab, setActiveTab] = useState("guide");
  const [token, setToken] = useState(() => {
    try {
      return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [session, setSession] = useState({ checking: Boolean(token), authenticated: false, username: "", expiresAt: null });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginStatus, setLoginStatus] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [draft, setDraft] = useState(() => mergeSiteContent(siteContent));
  const [selectedArticle, setSelectedArticle] = useState(siteContent.guide.articles[0]?.slug || "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = mergeSiteContent(siteContent);
    setDraft(next);
    setSelectedArticle((current) => current || next.guide.articles[0]?.slug || "");
  }, [siteContent]);

  useEffect(() => {
    if (!token) {
      setSession({ checking: false, authenticated: false, username: "", expiresAt: null });
      return;
    }
    let cancelled = false;
    setSession((current) => ({ ...current, checking: true }));
    fetch("/api/v1/admin/session", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Oturum doğrulanamadı.");
        if (!cancelled) setSession({ checking: false, authenticated: true, username: payload.username || "", expiresAt: payload.expiresAt || null });
      })
      .catch(() => {
        try {
          window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        } catch {}
        if (!cancelled) {
          setToken("");
          setSession({ checking: false, authenticated: false, username: "", expiresAt: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const articles = draft.guide.articles;
  const selected = articles.find((article) => article.slug === selectedArticle) || articles[0];
  const setPath = (section, key, value) => setDraft((current) => ({
    ...current,
    [section]: { ...current[section], [key]: value },
  }));
  const updateGuide = (key, value) => setDraft((current) => ({
    ...current,
    guide: { ...current.guide, [key]: value },
  }));
  const updateArticle = (slug, patch) => setDraft((current) => ({
    ...current,
    guide: {
      ...current.guide,
      articles: current.guide.articles.map((article) => article.slug === slug ? { ...article, ...patch } : article),
    },
  }));
  const updateSection = (slug, index, patch) => setDraft((current) => ({
    ...current,
    guide: {
      ...current.guide,
      articles: current.guide.articles.map((article) => article.slug === slug ? {
        ...article,
        sections: article.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
      } : article),
    },
  }));
  const addArticle = () => {
    const title = "Yeni Rehber Yazısı";
    const baseSlug = slugifyText(title);
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
    const article = {
      slug: uniqueSlug,
      tag: "Proje Rehberi",
      time: "10 dk",
      title,
      text: "Bu yazının kısa açıklamasını yazın.",
      coverImage: "",
      sections: [{ title: "Giriş", body: "Yazının ilk bölümünü buraya ekleyin." }],
    };
    setDraft((current) => ({
      ...current,
      guide: { ...current.guide, articles: [article, ...current.guide.articles] },
    }));
    setSelectedArticle(uniqueSlug);
  };
  const removeArticle = (slug) => {
    setDraft((current) => {
      const nextArticles = current.guide.articles.filter((article) => article.slug !== slug);
      setSelectedArticle(nextArticles[0]?.slug || "");
      return { ...current, guide: { ...current.guide, articles: nextArticles } };
    });
  };
  const login = async (event) => {
    event.preventDefault();
    setLoggingIn(true);
    setLoginStatus("");
    try {
      const response = await fetch("/api/v1/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error === "invalid_admin_credentials" ? "Kullanıcı adı veya şifre hatalı." : "Admin girişi yapılamadı.");
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, payload.token);
      setToken(payload.token);
      setSession({ checking: false, authenticated: true, username: payload.username || loginForm.username, expiresAt: payload.expiresAt || null });
      setLoginForm({ username: "", password: "" });
    } catch (error) {
      setLoginStatus(error.message || "Admin girişi yapılamadı.");
    } finally {
      setLoggingIn(false);
    }
  };
  const logout = () => {
    try {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {}
    setToken("");
    setSession({ checking: false, authenticated: false, username: "", expiresAt: null });
    setStatus("");
  };
  const save = async () => {
    if (!session.authenticated || !token) {
      setStatus("Kaydetmek için admin girişi yapmalısınız.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/v1/admin/site-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: draft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "İçerik kaydedilemedi.");
      setDraft(mergeSiteContent(payload.content));
      setStatus("İçerik kaydedildi. Public sayfalar güncel içerikle beslenecek.");
      onContentSaved();
    } catch (error) {
      setStatus(error.message || "İçerik kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (session.checking) {
    return (
      <>
        <Breadcrumb items={[{ label: "Admin" }]} />
        <PageHero eyebrow="Admin" title="Admin Paneli" text="Oturum doğrulanıyor." />
        <section className="content adminLoginShell">
          <article className="adminLoginCard"><RefreshCw size={20} className="spin" /><strong>Oturum kontrol ediliyor</strong></article>
        </section>
      </>
    );
  }

  if (!session.authenticated) {
    return (
      <>
        <Breadcrumb items={[{ label: "Admin" }]} />
        <PageHero eyebrow="Admin" title="Admin Girişi" text="Bu alana yalnızca yetkili kullanıcı adı ve şifreyle erişilebilir." />
        <section className="content adminLoginShell">
          <form className="adminLoginCard" onSubmit={login}>
            <ShieldCheck size={30} />
            <h2>Yetkili Girişi</h2>
            <label>
              Kullanıcı adı
              <input value={loginForm.username} onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))} autoComplete="username" required />
            </label>
            <label>
              Şifre
              <input value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} type="password" autoComplete="current-password" required />
            </label>
            <button className="primaryAction" type="submit" disabled={loggingIn}>
              {loggingIn ? <RefreshCw size={16} className="spin" /> : <ShieldCheck size={16} />}
              Giriş Yap
            </button>
            {loginStatus && <p className="adminStatus" role="alert">{loginStatus}</p>}
          </form>
        </section>
      </>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Admin" }]} />
      <PageHero eyebrow="Admin" title="İçerik ve Site Yönetimi" text="Görselleri, ana sayfa bloklarını ve proje rehberi blog yazılarını tek panelden düzenleyin." />
      <section className="content adminEditorShell">
        <aside className="adminSidebar">
          <div className="adminSessionBox">
            <span>Oturum açık</span>
            <strong>{session.username || "Admin"}</strong>
            {session.expiresAt && <small>{formatDateTime(session.expiresAt)} tarihine kadar</small>}
          </div>
          <nav aria-label="Admin bölümleri">
            {[
              ["guide", "Proje rehberi"],
              ["visuals", "Görseller"],
              ["home", "Ana sayfa"],
              ["system", "Sistem"],
            ].map(([key, label]) => (
              <button key={key} type="button" className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>{label}</button>
            ))}
          </nav>
          <button className="primaryAction" type="button" onClick={save} disabled={saving}>
            {saving ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
            Değişiklikleri Kaydet
          </button>
          <button className="secondaryAction" type="button" onClick={logout}>Çıkış Yap</button>
          {status && <p className="adminStatus" role="status">{status}</p>}
        </aside>

        <div className="adminEditorMain">
          {activeTab === "visuals" && (
            <section className="adminPanel">
              <div className="panelTitle"><h2><FileText size={22} /> Görsel Alanları</h2></div>
              <div className="adminFormGrid">
                {[
                  ["logoSvg", "Header logo SVG"],
                  ["logoPng", "Kart/promo logo PNG"],
                  ["heroImage", "Ana sayfa hero görseli"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input value={draft.images[key] || ""} onChange={(event) => setPath("images", key, event.target.value)} placeholder="/logo.svg veya https://..." />
                  </label>
                ))}
              </div>
              <div className="adminImagePreview">
                <img src={draft.images.logoSvg || "/logo.svg"} alt="Logo önizleme" />
                {draft.images.heroImage ? <img src={draft.images.heroImage} alt="Hero önizleme" /> : <span>Hero görseli eklenmedi</span>}
              </div>
            </section>
          )}

          {activeTab === "home" && (
            <section className="adminPanel">
              <div className="panelTitle"><h2><Sparkles size={22} /> Ana Sayfa Bölümleri</h2></div>
              <label>Hero başlığı<input value={draft.home.heroTitle} onChange={(event) => setPath("home", "heroTitle", event.target.value)} /></label>
              <label>Hero açıklaması<textarea rows={4} value={draft.home.heroText} onChange={(event) => setPath("home", "heroText", event.target.value)} /></label>
              <label>Yan promo başlığı<input value={draft.home.promoTitle} onChange={(event) => setPath("home", "promoTitle", event.target.value)} /></label>
              <label>Yan promo açıklaması<textarea rows={3} value={draft.home.promoText} onChange={(event) => setPath("home", "promoText", event.target.value)} /></label>
            </section>
          )}

          {activeTab === "guide" && (
            <section className="adminPanel guideEditor">
              <div className="adminPanelHeader">
                <div className="panelTitle"><h2><BookOpen size={22} /> Proje Rehberi Blog Editörü</h2></div>
                <button type="button" onClick={addArticle}><FileText size={16} /> Yeni Yazı</button>
              </div>
              <div className="adminFormGrid">
                <label>Rehber sayfası başlığı<input value={draft.guide.heroTitle} onChange={(event) => updateGuide("heroTitle", event.target.value)} /></label>
                <label>Kategoriler<input value={draft.guide.categories.join(", ")} onChange={(event) => updateGuide("categories", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
              </div>
              <label>Rehber sayfası açıklaması<textarea rows={3} value={draft.guide.heroText} onChange={(event) => updateGuide("heroText", event.target.value)} /></label>
              <div className="articleEditorLayout">
                <div className="articleList">
                  {articles.map((article) => (
                    <button key={article.slug} type="button" className={selected?.slug === article.slug ? "active" : ""} onClick={() => setSelectedArticle(article.slug)}>
                      <strong>{article.title}</strong>
                      <span>{article.tag} · {article.sections.length} bölüm</span>
                    </button>
                  ))}
                </div>
                {selected ? (
                  <div className="articleEditor">
                    <div className="adminFormGrid">
                      <label>Başlık<input value={selected.title} onChange={(event) => {
                        const nextTitle = event.target.value;
                        updateArticle(selected.slug, { title: nextTitle, slug: slugifyText(nextTitle) || selected.slug });
                        setSelectedArticle(slugifyText(nextTitle) || selected.slug);
                      }} /></label>
                      <label>Slug<input value={selected.slug} onChange={(event) => {
                        const nextSlug = slugifyText(event.target.value) || selected.slug;
                        updateArticle(selected.slug, { slug: nextSlug });
                        setSelectedArticle(nextSlug);
                      }} /></label>
                      <label>Kategori<input value={selected.tag} onChange={(event) => updateArticle(selected.slug, { tag: event.target.value })} /></label>
                      <label>Okuma süresi<input value={selected.time} onChange={(event) => updateArticle(selected.slug, { time: event.target.value })} /></label>
                    </div>
                    <label>Kısa açıklama<textarea rows={3} value={selected.text} onChange={(event) => updateArticle(selected.slug, { text: event.target.value })} /></label>
                    <label>Kapak görseli URL<input value={selected.coverImage || ""} onChange={(event) => updateArticle(selected.slug, { coverImage: event.target.value })} placeholder="https://... veya /gorsel.png" /></label>
                    <div className="sectionEditorHeader">
                      <h3>Yazı Bölümleri</h3>
                      <button type="button" onClick={() => updateArticle(selected.slug, { sections: [...selected.sections, { title: "Yeni bölüm", body: "" }] })}>Bölüm Ekle</button>
                    </div>
                    {selected.sections.map((section, index) => (
                      <article className="sectionEditor" key={`${selected.slug}-${index}`}>
                        <div>
                          <label>Bölüm başlığı<input value={section.title} onChange={(event) => updateSection(selected.slug, index, { title: event.target.value })} /></label>
                          <button type="button" aria-label="Bölümü sil" onClick={() => updateArticle(selected.slug, { sections: selected.sections.filter((_, sectionIndex) => sectionIndex !== index) })}><X size={16} /></button>
                        </div>
                        <label>İçerik<textarea rows={6} value={section.body} onChange={(event) => updateSection(selected.slug, index, { body: event.target.value })} /></label>
                      </article>
                    ))}
                    <button className="dangerButton" type="button" onClick={() => removeArticle(selected.slug)}>Bu Yazıyı Sil</button>
                  </div>
                ) : <EmptyState title="Rehber yazısı yok" text="Yeni Yazı butonuyla ilk blog içeriğini oluşturun." />}
              </div>
            </section>
          )}

          {activeTab === "system" && (
            <section className="adminPanel">
              <div className="panelTitle"><h2><RefreshCw size={22} /> Sistem Sağlığı</h2></div>
              <div className="detailGrid">
                <DetailItem label="Son çekim" value={formatDateTime(fetchedAt)} />
                <DetailItem label="Kaynak uyarısı" value={errors.length} />
                <DetailItem label="Yakında kapanan" value={model.urgent.length} />
                <DetailItem label="Yeni yakalanan" value={model.recentlyDetected.length} />
              </div>
            </section>
          )}
        </div>
      </section>
      <section className="content adminGrid">
        <article><Database size={24} /><strong>{model.funderList.length}</strong><span>Aktif kaynak/kurum</span></article>
        <article><ClipboardList size={24} /><strong>{openCalls}</strong><span>Açık çağrı</span></article>
        <article><AlertCircle size={24} /><strong>{manualReview}</strong><span>Manuel inceleme</span></article>
        <article><ShieldCheck size={24} /><strong>{lowConfidence}</strong><span>Düşük güven</span></article>
      </section>
      <section className="content dashboardIntro">
        <div className="dashboardPanel">
          <div className="panelTitle"><h2><RefreshCw size={23} /> Sistem Sağlığı</h2></div>
          <div className="detailGrid">
            <DetailItem label="Son çekim" value={formatDateTime(fetchedAt)} />
            <DetailItem label="Kaynak uyarısı" value={errors.length} />
            <DetailItem label="Yakında kapanan" value={model.urgent.length} />
            <DetailItem label="Yeni yakalanan" value={model.recentlyDetected.length} />
          </div>
        </div>
        <div className="dashboardPanel">
          <div className="panelTitle"><h2><ListFilter size={23} /> İnceleme Kuyruğu</h2></div>
          <div className="compactList">
            {model.calls.filter((call) => call.requiresManualReview || !call.deadline || (call.confidenceScore || 0) < 75).slice(0, 8).map((call) => <CompactCall key={call.id} call={call} variant="detected" />)}
            {!manualReview && <p className="emptyInline">Bekleyen manuel inceleme sinyali yok.</p>}
          </div>
        </div>
      </section>
    </>
  );
}

function surveyPayload(form) {
  const themes = [
    form.researchField,
    ...form.themes,
    ...tokenizeSearch(form.projectSummary).filter((token) => token.length > 3).slice(0, 5),
  ].filter(Boolean);
  const preferredScopes = form.preferredScopes.length ? form.preferredScopes : ["national"];
  const destinations = surveyScopes.filter((scope) => preferredScopes.includes(scope.value)).map((scope) => scope.destination);
  return {
    userType: form.userType,
    academicLevel: form.academicLevel,
    currentAcademicLevel: form.academicLevel,
    researchField: [form.researchField, form.projectSummary].filter(Boolean).join(" - "),
    projectSummary: form.projectSummary,
    location: form.location,
    targetDestination: form.targetDestination || destinations[0] || "Turkey",
    searchScope: preferredScopes.includes("international") ? "global" : preferredScopes.join(","),
    preferredScopes,
    themes: [...new Set(themes)].slice(0, 12),
    budgetNeed: form.budgetNeed,
    timing: form.timing,
  };
}

function GrantSurvey({ compact = false, onComplete }) {
  const [form, setForm] = useState(surveyInitialState);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const selectedType = surveyUserTypes.find((type) => type.value === form.userType) || surveyUserTypes[0];
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleScope = (scope) => setForm((current) => {
    const exists = current.preferredScopes.includes(scope);
    const preferredScopes = exists ? current.preferredScopes.filter((item) => item !== scope) : [...current.preferredScopes, scope];
    const firstScope = surveyScopes.find((item) => item.value === preferredScopes[0]);
    return {
      ...current,
      preferredScopes: preferredScopes.length ? preferredScopes : ["national"],
      targetDestination: firstScope?.destination || current.targetDestination,
    };
  });
  const toggleTheme = (theme) => setForm((current) => ({
    ...current,
    themes: current.themes.includes(theme) ? current.themes.filter((item) => item !== theme) : [...current.themes, theme],
    researchField: current.researchField || theme,
  }));
  const submit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/v1/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(surveyPayload(form)),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Eşleştirme tamamlanamadı.");
      setResult(payload);
      setStatus("done");
      if (onComplete) onComplete(payload);
    } catch (err) {
      setError(err.message || "Anket sonucu alınamadı.");
      setStatus("error");
    }
  };
  return (
    <div className={`surveyExperience ${compact ? "compact" : ""}`}>
      <form className="surveyForm" onSubmit={submit}>
        <div className="surveyStep">
          <span>1</span>
          <div>
            <h2>Başvuru profiliniz</h2>
            <p>Öneriler önce başvuru sahibi uygunluğuna göre süzülür.</p>
          </div>
        </div>
        <div className="surveyChoiceGrid">
          {surveyUserTypes.map(({ value, label, academicLevel, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={form.userType === value ? "selected" : ""}
              onClick={() => setForm((current) => ({ ...current, userType: value, academicLevel }))}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="surveyFields">
          <label>
            Çalışma alanınız
            <input value={form.researchField} onChange={(event) => update("researchField", event.target.value)} placeholder="Örn. yapay zeka, sağlık teknolojileri, tarımsal Ar-Ge" required />
          </label>
          <label>
            Proje / araştırma konusu
            <textarea value={form.projectSummary} onChange={(event) => update("projectSummary", event.target.value)} placeholder="Kısaca fikrinizi, hedef kitlenizi ve beklenen çıktıyı yazın." rows={compact ? 3 : 4} />
          </label>
          <div className="surveyTwoCol">
            <label>
              Bulunduğunuz ülke
              <input value={form.location} onChange={(event) => update("location", event.target.value)} />
            </label>
            <label>
              Aradığınız destek zamanı
              <select value={form.timing} onChange={(event) => update("timing", event.target.value)}>
                <option value="open">Şu an açık çağrılar</option>
                <option value="upcoming">Yaklaşan çağrılar</option>
                <option value="any">Tüm uygun fırsatlar</option>
              </select>
            </label>
          </div>
        </div>
        <div className="surveyStep">
          <span>2</span>
          <div>
            <h2>Hibe kapsamı</h2>
            <p>{selectedType.label} profili için uygun kapsam ve temaları seçin.</p>
          </div>
        </div>
        <div className="surveyChipGroup" aria-label="Kapsam seçimi">
          {surveyScopes.map((scope) => (
            <button key={scope.value} type="button" className={form.preferredScopes.includes(scope.value) ? "selected" : ""} onClick={() => toggleScope(scope.value)}>
              {scope.label}
            </button>
          ))}
        </div>
        <div className="surveyChipGroup themes" aria-label="Tematik alanlar">
          {surveyFields.map((field) => (
            <button key={field} type="button" className={form.themes.includes(field) ? "selected" : ""} onClick={() => toggleTheme(field)}>
              {field}
            </button>
          ))}
        </div>
        <label className="surveyBudget">
          Tahmini destek ihtiyacı
          <input value={form.budgetNeed} onChange={(event) => update("budgetNeed", event.target.value)} placeholder="Örn. 500.000 TL, 100.000 EUR veya henüz belli değil" />
        </label>
        {error && <p className="surveyError" role="alert">{error}</p>}
        <div className="surveyActions">
          <button className="primaryAction" type="submit" disabled={status === "loading"}>
            {status === "loading" ? <RefreshCw size={17} className="spin" /> : <Sparkles size={17} />}
            En uygun hibeleri göster
          </button>
          {result && <button type="button" onClick={() => setResult(null)}>Yeni sonuç için formu düzenle</button>}
        </div>
      </form>
      {result && <SurveyResults result={result} />}
    </div>
  );
}

function SurveyResults({ result }) {
  const globalMatches = result?.globalFunding?.matches || [];
  const calls = result?.calls || [];
  return (
    <section className="surveyResults" aria-live="polite">
      <div className="sectionHeader">
        <div>
          <h2>Size en uygun eşleşmeler</h2>
          <p>Sonuçlar profil uygunluğu, kapsam ve çalışma alanı sinyallerine göre sıralandı.</p>
        </div>
        <div className="health"><Star size={17} /> {globalMatches.length + calls.length} öneri</div>
      </div>
      {!!globalMatches.length && (
        <div className="fundingMatchGrid">
          {globalMatches.slice(0, 4).map((match) => (
            <article key={match.id} className="fundingMatchCard">
              <div>
                <span>{match.match_score} puan</span>
                <h3>{match.name}</h3>
                <p>{match.region_country} · {match.type}</p>
              </div>
              <div className="tagCloud">
                {match.target_audiences.slice(0, 4).map((item) => <span key={item}>{item}</span>)}
              </div>
              {!!match.example_programs?.length && (
                <ul className="cleanList">
                  {match.example_programs.slice(0, 3).map((program) => <li key={program}>{program}</li>)}
                </ul>
              )}
              <a href={ensureHttp(match.website)} target="_blank" rel="noopener noreferrer">Resmî sayfayı aç <ArrowUpRight size={15} /></a>
            </article>
          ))}
        </div>
      )}
      {!!calls.length && (
        <div className="surveyCallMatches">
          <h3>Açık çağrı önerileri</h3>
          <div className="cardGrid">
            {calls.slice(0, 4).map((call) => <CallCard key={call.id} call={call} mode="link" />)}
          </div>
        </div>
      )}
      {!globalMatches.length && !calls.length && (
        <EmptyState title="Uygun eşleşme bulunamadı" text="Çalışma alanını veya kapsam seçimini genişleterek tekrar deneyin." />
      )}
    </section>
  );
}

function GrantSurveyPage() {
  usePageMeta("Hibe Anketi | Hibe Rota", "Profilinize göre en uygun açık proje hibe ve fon başvurularını bulun.");
  return (
    <>
      <Breadcrumb items={[{ label: "Hibe Anketi" }]} />
      <PageHero
        eyebrow="Akıllı eşleştirme"
        title="Profilinize en uygun hibe ve proje çağrısını bulun"
        text="Kısa anketi doldurun; çalışma alanınız, başvuru sahibi tipiniz ve hedef kapsamınıza göre açık çağrılar ve fon programları listelensin."
      />
      <section className="content surveyPage">
        <GrantSurvey />
      </section>
    </>
  );
}

function FirstVisitSurveyModal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SURVEY_SEEN_KEY)) return;
      if (window.location.pathname === "/hibe-anketi") return;
      setVisible(true);
    } catch {
      setVisible(false);
    }
  }, []);
  const close = () => {
    try {
      window.localStorage.setItem(SURVEY_SEEN_KEY, new Date().toISOString());
    } catch { /* localStorage unavailable */ }
    setVisible(false);
  };
  if (!visible) return null;
  return (
    <div className="surveyModalBackdrop" role="presentation">
      <section className="surveyModal" role="dialog" aria-modal="true" aria-labelledby="survey-modal-title">
        <button className="surveyModalClose" type="button" aria-label="Anketi kapat" onClick={close}><X size={18} /></button>
        <div className="surveyModalIntro">
          <span><Sparkles size={18} /> İlk ziyaret anketi</span>
          <h2 id="survey-modal-title">Size uygun hibe başvurusunu birlikte bulalım</h2>
          <p>Bu anket yalnızca ilk girişte açılır. Daha sonra üst menüdeki Hibe Anketi bölümünden tekrar doldurabilirsiniz.</p>
        </div>
        <GrantSurvey compact onComplete={close} />
        <button className="surveyLater" type="button" onClick={close}>Daha sonra dolduracağım</button>
      </section>
    </div>
  );
}

function NotFoundPage() {
  usePageMeta("Sayfa Bulunamadı | Hibe Rota", "Aradığınız sayfa bulunamadı.");
  return (
    <>
      <Breadcrumb items={[{ label: "404" }]} />
      <PageHero eyebrow="404" title="Sayfa bulunamadı" text="Bu bağlantı taşınmış veya mevcut değil." />
      <section className="content staticContent">
        <article><a className="primaryAction" href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>Ana Sayfaya Dön</a></article>
      </section>
    </>
  );
}

function App() {
  const route = useRoute();
  const routeSearch = route.params.toString();
  const { calls, errors, fetchedAt, loading, refresh, automation } = useCalls();
  const { content: siteContent, refresh: refreshSiteContent } = useSiteContent();
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      ...defaultCallFilters,
      query: params.get("q") || "",
      scope: queryToScope(params.get("scope")),
      status: params.get("status") || "open",
      category: params.get("category") || "",
      funder: params.get("funder") || "",
      targetGroup: params.get("targetGroup") || params.get("audience") || "",
      keyword: params.get("keyword") || params.get("keywords") || "",
      thematicArea: params.get("thematicArea") || params.get("theme") || "",
      country: params.get("country") || "",
      currency: params.get("currency") || "",
      budgetMin: params.get("budgetMin") || "",
      budgetMax: params.get("budgetMax") || "",
      deadlineWithin: params.get("deadlineWithin") || "",
      deadlineFrom: params.get("deadlineFrom") || "",
      deadlineTo: params.get("deadlineTo") || "",
      officialOnly: booleanFilterParam(params.get("officialOnly")),
      sort: params.get("sort") || "deadline_asc",
    };
  });

  useEffect(() => {
    const eventSource = new EventSource("/api/v1/stream");
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "refresh") {
          refresh();
        }
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };
    return () => eventSource.close();
  }, [refresh]);

  useEffect(() => {
    const params = route.params;
    setFilters((current) => ({
      ...current,
      query: params.has("q") ? params.get("q") : current.query,
      scope: inferScopeFromFilters({
        ...current,
        funder: params.has("funder") ? params.get("funder") : current.funder,
        scope: params.get("scope") ? queryToScope(params.get("scope")) : "Tümü",
      }, calls, route.pathname),
      status: params.get("status") || current.status,
      category: params.has("category") ? params.get("category") : current.category,
      funder: params.has("funder") ? params.get("funder") : current.funder,
      targetGroup: params.has("targetGroup") ? params.get("targetGroup") : current.targetGroup,
      keyword: params.has("keyword") ? params.get("keyword") : params.has("keywords") ? params.get("keywords") : current.keyword,
      thematicArea: params.has("thematicArea") ? params.get("thematicArea") : current.thematicArea,
      country: params.has("country") ? params.get("country") : current.country,
      currency: params.has("currency") ? params.get("currency") : current.currency,
      budgetMin: params.has("budgetMin") ? params.get("budgetMin") : current.budgetMin,
      budgetMax: params.has("budgetMax") ? params.get("budgetMax") : current.budgetMax,
      deadlineWithin: params.has("deadlineWithin") ? params.get("deadlineWithin") : (route.pathname === "/cagrilar/yaklasan" ? "45" : current.deadlineWithin),
      deadlineFrom: params.has("deadlineFrom") ? params.get("deadlineFrom") : current.deadlineFrom,
      deadlineTo: params.has("deadlineTo") ? params.get("deadlineTo") : current.deadlineTo,
      officialOnly: params.has("officialOnly") ? booleanFilterParam(params.get("officialOnly")) : current.officialOnly,
      sort: params.get("sort") || current.sort,
    }));
  }, [calls, route.pathname, routeSearch]);

  const model = useMemo(() => {
    const indexedCalls = calls.map((call) => ({ ...call, searchIndex: callKeywords(call) }));
    const openCalls = indexedCalls.filter((call) => callStatusGroup(call) === "open");
    const urgent = openCalls
      .filter((call) => {
        const left = daysLeft(call.deadline);
        return left !== null && left >= 0 && left <= 45;
      })
      .sort((a, b) => deadlineTime(a) - deadlineTime(b));
    const newlyOpened = openCalls.slice().sort((a, b) => publishedTime(b) - publishedTime(a) || deadlineTime(a) - deadlineTime(b));
    const recentlyDetected = openCalls
      .filter((call) => call.firstDetectedAt || call.lastDetectedAt)
      .sort((a, b) => new Date(b.firstDetectedAt || b.lastDetectedAt || 0).getTime() - new Date(a.firstDetectedAt || a.lastDetectedAt || 0).getTime())
      .filter((call, index, array) => {
        const detectedAt = new Date(call.firstDetectedAt || call.lastDetectedAt || 0).getTime();
        if (!Number.isFinite(detectedAt) || detectedAt <= 0) return false;
        const withinSevenDays = detectedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
        return withinSevenDays || index < Math.min(6, array.length);
      });
    const funderCounts = new Map();
    const categoryCounts = new Map();
    const targetGroupCounts = new Map();
    const keywordOptions = buildKeywordOptions(indexedCalls);
    const themeCounts = new Map();
    const countryCounts = new Map();
    const currencyCounts = new Map();
    indexedCalls.forEach((call) => {
      funderCounts.set(call.funder, (funderCounts.get(call.funder) || 0) + 1);
      categoryCounts.set(call.category || "Genel", (categoryCounts.get(call.category || "Genel") || 0) + 1);
      targetGroups(call).forEach((group) => targetGroupCounts.set(group, (targetGroupCounts.get(group) || 0) + 1));
      callThemes(call).forEach((theme) => themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1));
      [call.country, ...(call.eligibleCountries || [])].filter(Boolean).forEach((country) => countryCounts.set(country, (countryCounts.get(country) || 0) + 1));
      if (call.currency) currencyCounts.set(call.currency, (currencyCounts.get(call.currency) || 0) + 1);
    });
    const funders = [...funderCounts.entries()].sort((a, b) => b[1] - a[1]);
    const categories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    const targetGroupOptions = [...targetGroupCounts.entries()].sort((a, b) => b[1] - a[1]).map(([group]) => group).slice(0, 18);
    const themeOptions = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([theme]) => theme).slice(0, 24);
    const countryOptions = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([country]) => country).slice(0, 24);
    const currencyOptions = [...currencyCounts.keys()].sort();
    const urgentWeek = urgent.filter((call) => {
      const left = daysLeft(call.deadline);
      return left !== null && left <= 7;
    }).length;
    return {
      calls: indexedCalls,
      openCalls,
      urgent,
      newlyOpened,
      recentlyDetected,
      funders,
      categories,
      funderList: funders.map(([funder]) => funder),
      categoryList: categories.map(([category]) => category),
      targetGroupOptions,
      keywordOptions,
      themeOptions,
      countryOptions,
      currencyOptions,
      urgentWeek,
      sourceCount: automation?.metrics?.activeSources ?? funders.length,
    };
  }, [calls, automation]);

  let page;
  if (route.pathname === "/") page = <HomePage model={model} filters={filters} setFilters={setFilters} siteContent={siteContent} />;
  else if (route.pathname === "/cagrilar" || route.pathname === "/cagrilar/ulusal" || route.pathname === "/cagrilar/avrupa" || route.pathname === "/cagrilar/uluslararasi" || route.pathname === "/cagrilar/yaklasan" || route.pathname === "/cagrilar/yeni") page = <CallsPage route={route} model={model} filters={filters} setFilters={setFilters} refresh={refresh} loading={loading} fetchedAt={fetchedAt} errors={errors} siteContent={siteContent} />;
  else if (route.pathname.startsWith("/cagrilar/") || route.pathname.startsWith("/cagri/")) page = <CallDetailPage route={route} model={model} />;
  else if (route.pathname === "/hibe-anketi") page = <GrantSurveyPage />;
  else if (route.pathname === "/programlar") page = <ProgrammesPage model={model} />;
  else if (route.pathname.startsWith("/program/")) page = <ProgrammeDetailPage route={route} model={model} />;
  else if (route.pathname === "/kurumlar") page = <FundersPage model={model} />;
  else if (route.pathname.startsWith("/kurum/")) page = <FunderDetailPage route={route} model={model} />;
  else if (route.pathname === "/takvim") page = <CalendarPage model={model} />;
  else if (route.pathname === "/rehber") page = <GuidePage siteContent={siteContent} />;
  else if (route.pathname.startsWith("/rehber/")) page = <GuideArticlePage route={route} siteContent={siteContent} />;
  else if (route.pathname === "/admin") page = <AdminPage model={model} errors={errors} fetchedAt={fetchedAt} siteContent={siteContent} onContentSaved={refreshSiteContent} />;
  else if (route.pathname === "/iletisim") page = <ContactPage />;
  else if (route.pathname === "/gizlilik-politikasi") page = <PrivacyPolicyPage />;
  else if (["/hakkimizda", "/sss", "/kullanim-kosullari"].includes(route.pathname)) page = <StaticPage type={route.pathname} />;
  else page = <NotFoundPage />;

  return (
    <div className="appShell">
      <Header route={route} siteContent={siteContent} />
      <main>{page}</main>
      <FirstVisitSurveyModal />
      <NewsletterCard />
      <Footer />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
