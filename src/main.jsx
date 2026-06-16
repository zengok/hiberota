import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
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
  MessageCircle,
  Menu,
  RefreshCw,
  Rocket,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import catalogData from "./data/catalog.json";
import { FavoriteButton } from "./components/FavoriteButton.jsx";
import { CallCardSkeleton } from "./components/SkeletonLoading.jsx";
import "./styles.css";

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
};

function formatDate(value) {
  if (!value) return "Tarih bekleniyor";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
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

function callKeywords(call) {
  const base = [
    call.title,
    call.funder,
    call.category,
    call.summary,
    call.source,
    call.scope,
    scopeLabel(call.scope),
    call.externalId,
    targetAudience(call),
  ];
  const joined = normalizeSearch(base.filter(Boolean).join(" "));
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

function formatDateTime(value) {
  if (!value) return "Henüz çekim yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  const cleanSummary = String(call.summary || call.category).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const details = encodeURIComponent(`${cleanSummary}\n${call.url}`);
  const url = encodeURIComponent(call.url);
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${ymd}/${ymd}&details=${details}&location=${url}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${text}&startdt=${start.toISOString()}&body=${details}`,
    ics: `/api/v1/calls/${encodeURIComponent(call.id)}/calendar.ics`,
  };
}

function formatBudget(call) {
  if (call.budgetMax) return `${Number(call.budgetMax).toLocaleString("tr-TR")} ${call.currency || ""}`.trim();
  if (call.support && !/belirtilir|doküman|detay|değişir/i.test(call.support)) return call.support;
  return "Resmî çağrı metninde belirtilir";
}

function formatSupportRate(call) {
  if (call.supportRate) return `%${call.supportRate}`;
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

  async function refresh({ force = false } = {}) {
    setState((current) => ({ ...current, loading: true }));
    try {
      const response = await fetch(force ? "/api/calls/refresh" : "/api/calls", { method: force ? "POST" : "GET" });
      const payload = await response.json();
      setState({ ...payload, loading: false });
    } catch (error) {
      setState({ calls: [], errors: [{ source: "Uygulama", message: error.message }], fetchedAt: null, loading: false });
    }
  }

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
  }, []);

  return { ...state, refresh };
}

function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title;
    const metas = [
      ["description", description],
      ["og:title", title, "property"],
      ["og:description", description, "property"],
      ["og:type", "website", "property"],
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
    canonical.setAttribute("href", `${window.location.origin}${window.location.pathname}`);
  }, [title, description]);
}

function filterCalls(calls, filters) {
  const groups = searchGroups(filters.query);
  const deadlineLimit = filters.deadlineWithin ? Number(filters.deadlineWithin) : null;
  return calls.filter((call) => {
    const left = daysLeft(call.deadline);
    return (
      matchesSearch(call, groups) &&
      (filters.scope === "Tümü" || call.scope === filters.scope) &&
      (filters.status === "all" || callStatusGroup(call) === filters.status) &&
      matchesCategory(call, filters.category) &&
      (!filters.funder || call.funder === filters.funder) &&
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

function Header({ route }) {
  const [open, setOpen] = useState(false);
  const active = (href) => href === "/" ? route.pathname === "/" : route.pathname.startsWith(href);
  return (
    <header className="topNav">
      <a className="brand" href="/" onClick={(event) => {
        event.preventDefault();
        navigate("/");
      }} aria-label="Hibe Rota ana sayfa">
        <span className="brandMark" aria-hidden="true"><Sparkles size={18} /></span>
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
  return (
    <a className="compactCall" href={callPath(call)} onClick={(event) => {
      event.preventDefault();
      navigate(callPath(call));
    }}>
      <span className={`compactDot ${variant || call.scope}`}></span>
      <div>
        <strong>{call.title}</strong>
        <span>{call.funder}</span>
      </div>
      <em>{metaLabel}</em>
    </a>
  );
}

function CallCard({ call, selected, onSelect, mode = "expand" }) {
  const progress = deadlineProgress(call);
  const links = calendarLinks(call);
  const asDetail = mode === "link";
  const openDetail = (event) => {
    event.stopPropagation();
    navigate(callPath(call));
  };

  return (
    <article className={`callCard ${selected ? "selected" : ""} scopeCard-${call.scope}`} onClick={asDetail ? undefined : onSelect}>
      <div className="progressLine" style={{ width: `${progress}%` }}></div>
      {!asDetail && (
        <button
          className="cardClose"
          type="button"
          aria-label="Detayı kapat"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(true);
          }}
        >
          <X size={16} />
        </button>
      )}
      <div className="cardTop">
        <span className="statusChip">{statusLabel(call.normalizedStatus || call.status)}</span>
        <span className={`scopeChip scope-${call.scope}`}>{scopeLabel(call.scope)}</span>
        <span className="sourceTrust"><ShieldCheck size={15} />{sourceBadge(call)}</span>
        <FavoriteButton callId={call.id} className="cardFavorite" label="Favori" />
      </div>
      <h3>{call.title}</h3>
      <p>{call.summary || call.category}</p>
      <div className="cardFacts">
        <DetailItem label="Kurum" value={call.funder} />
        <DetailItem label="Destek" value={call.support} />
        <DetailItem label="Son Başvuru" value={formatDate(call.deadline)} />
      </div>
      {(selected || asDetail) && (
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
            <a href={call.url} target="_blank" rel="noopener noreferrer">Resmi Başvuru <ArrowUpRight size={15} /></a>
            <a href={links.ics}>ICS indir</a>
          </div>
        </div>
      )}
    </article>
  );
}

function FilterPanel({ calls, filters, setFilters, categories, funders, refresh, loading, fetchedAt, lockedScope }) {
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
        <h2><ListFilter size={21} /> Filtreler</h2>
        <button type="button" onClick={() => setFilters((current) => ({ ...current, query: "", scope: lockedScope || "Tümü", status: "open", category: "", funder: "", deadlineWithin: "", sort: "deadline_asc" }))}>Temizle</button>
      </div>
      <label className="fieldLabel">
        <span>Arama</span>
        <span className="inlineSearch">
          <Search size={20} />
          <input value={filters.query} onChange={(event) => update("query", event.target.value)} placeholder="Çağrı adı, kurum veya anahtar kelime" />
        </span>
      </label>
      <div className="segmentGroup" aria-label="Çağrı türü filtresi">
        {filterTabs.map((tab) => (
          <button key={tab.value} type="button" disabled={Boolean(lockedScope) && lockedScope !== tab.value} className={filters.scope === tab.value ? "active" : ""} onClick={() => update("scope", tab.value)}>
            <span className={`segmentDot ${tab.dot}`}></span>
            {tab.label}
          </button>
        ))}
      </div>
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
          <span>Son tarih</span>
          <select value={filters.deadlineWithin} onChange={(event) => update("deadlineWithin", event.target.value)}>
            <option value="">Tüm tarihler</option>
            <option value="7">7 gün içinde</option>
            <option value="30">30 gün içinde</option>
            <option value="45">45 gün içinde</option>
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
      <div className="syncBox">
        <button className="refresh" onClick={() => refresh({ force: true })} disabled={loading} title="Kaynakları yenile">
          <RefreshCw size={18} className={loading ? "spin" : ""} />
          Yenile
        </button>
        <span><i></i> Her saat başı canlı güncellenir</span>
        <small>Son çekim: {formatDateTime(fetchedAt)}</small>
      </div>
    </aside>
  );
}

function EmptyState({ title = "Sonuç bulunamadı", text = "Filtreleri değiştirerek tekrar deneyin." }) {
  return <div className="emptyState"><AlertCircle size={24} /><strong>{title}</strong><p>{text}</p></div>;
}

function LoadingState() {
  return <div className="emptyState"><RefreshCw className="spin" size={24} /><strong>Çağrılar yükleniyor</strong><p>Canlı kaynaklar taranıyor.</p></div>;
}

function HomePage({ model, filters, setFilters }) {
  usePageMeta("Hibe Rota | Ana Sayfa", "Ulusal ve uluslararası hibe, fon ve proje destek çağrılarını canlı kaynaklardan izleyin.");
  const { openCalls, urgent, newlyOpened, recentlyDetected, funders, categories, urgentWeek } = model;
  return (
    <>
      <section className="hero content">
        <div className="heroCopy">
          <h1>Projenize uygun destek çağrısını bulun</h1>
          <p>Ulusal ve uluslararası binlerce hibe, fon ve destek programını tek noktadan keşfedin. İhtiyacınız olan finansmana en kısa yoldan ulaşın.</p>
        </div>
        <form className="heroSearch" onSubmit={(event) => {
          event.preventDefault();
          navigate(`/cagrilar?scope=all&q=${encodeURIComponent(filters.query)}`);
        }}>
          <Search size={24} />
          <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Program, kurum, proje alanı veya çağrı adı ara" aria-label="Çağrı arama" />
          <button type="submit">Ara</button>
        </form>
        <div className="popularTags">
          <span>Popüler Aramalar:</span>
          {["TÜBİTAK 1001", "Yapay Zekâ", "Horizon Europe", "KOSGEB AR-GE"].map((tag) => (
            <button key={tag} type="button" onClick={() => {
              setFilters((current) => ({ ...current, query: tag, scope: "Tümü" }));
              navigate(`/cagrilar?q=${encodeURIComponent(tag)}&scope=all`);
            }}>{tag}</button>
          ))}
        </div>
      </section>

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

      <section className="statsStrip">
        <div className="content statsGrid">
          <div><strong>{catalogData.catalog.length}+</strong><span>Destek Programı</span></div>
          <div><strong>{openCalls.length}</strong><span>Açık Çağrı</span></div>
          <div><strong>{funders.length}</strong><span>Aktif Kaynak</span></div>
          <div><strong>{urgentWeek}</strong><span>7 Gün İçinde Kapanan</span></div>
        </div>
      </section>

      <section className="content dashboardIntro">
        <div className="dashboardPanel">
          <div className="panelTitle">
            <h2><Timer size={23} /> Başvuru Tarihi Yaklaşanlar</h2>
            <a href="/cagrilar/yaklasan" onClick={(event) => { event.preventDefault(); navigate("/cagrilar/yaklasan"); }}>Tümünü Gör</a>
          </div>
          <div className="compactList">
            {urgent.slice(0, 5).map((call) => <CompactCall key={call.id} call={call} />)}
            {!urgent.length && <p className="emptyInline">Yaklaşan son tarih bulunamadı.</p>}
          </div>
        </div>
        <div className="dashboardPanel">
          <div className="panelTitle">
            <h2><Sparkles size={23} /> Yeni Açılanlar</h2>
            <a href="/cagrilar?sort=newest" onClick={(event) => { event.preventDefault(); navigate("/cagrilar?sort=newest"); }}>Tümünü Gör</a>
          </div>
          <div className="compactList">
            {newlyOpened.slice(0, 5).map((call) => <CompactCall key={call.id} call={call} variant="new" />)}
            {!newlyOpened.length && <p className="emptyInline">Yeni çağrı bulunamadı.</p>}
          </div>
        </div>
      </section>

      <section className="content dashboardIntro">
        <div className="dashboardPanel">
          <div className="panelTitle">
            <h2><RefreshCw size={23} /> Otomasyonun Yeni Yakaladıkları</h2>
            <a href="/cagrilar?sort=newest&status=open" onClick={(event) => { event.preventDefault(); navigate("/cagrilar?sort=newest&status=open"); }}>Tümünü Gör</a>
          </div>
          <p className="panelNote">Her saat başı yapılan taramada yeni tespit edilen ve bağlantısı doğrulanmış açık destek başvuruları burada listelenir.</p>
          <div className="compactList">
            {recentlyDetected.slice(0, 6).map((call) => <CompactCall key={call.id} call={call} variant="detected" />)}
            {!recentlyDetected.length && <p className="emptyInline">Son saatlik taramalarda yeni doğrulanmış çağrı yakalanmadı.</p>}
          </div>
        </div>
      </section>

      <section className="content homeSummaryGrid">
        <SummaryCard icon={Database} title="Destek Programları" text={`${catalogData.catalog.length} katalog kaydı ve ${categories.length} canlı kategori.`} href="/programlar" />
        <SummaryCard icon={Building2} title="Kurumlar" text={`${funders.length} aktif fon sağlayıcı canlı kaynaklardan izleniyor.`} href="/kurumlar" />
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

function CallsPage({ route, model, filters, setFilters, refresh, loading, fetchedAt, errors }) {
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
    deadlineWithin: pageFilters.deadlineWithin,
    sort: pageFilters.sort,
  }).toString();
  return (
    <>
      <Breadcrumb items={[{ label: pageTitle }]} />
      <PageHero eyebrow="Çağrılar" title={pageTitle} text={pageText} />
      <section className="content callsSection">
        <button className="mobileFilterTrigger" type="button" onClick={() => setFiltersOpen(true)}>
          <ListFilter size={18} />
          Filtrele
        </button>
        {filtersOpen && <button className="filterBackdrop" type="button" aria-label="Filtreleri kapat" onClick={() => setFiltersOpen(false)} />}
        <div className={`filterSheet ${filtersOpen ? "open" : ""}`}>
          <button className="sheetClose" type="button" aria-label="Filtreleri kapat" onClick={() => setFiltersOpen(false)}><X size={18} /></button>
          <FilterPanel calls={model.calls} filters={pageFilters} setFilters={setFilters} categories={model.categoryList} funders={model.funderList} refresh={refresh} loading={loading} fetchedAt={fetchedAt} lockedScope={scopeFromRoute} />
        </div>
        <div className="resultsArea">
          <div className="sectionHeader">
            <div>
              <h2>{pageTitle}</h2>
              <p>{filtered.length} çağrı listeleniyor. Varsayılan sıralama son başvuru tarihine göredir.</p>
            </div>
            <div className="health">{errors.length ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{errors.length ? `${errors.length} kaynak uyarısı` : "Kaynaklar aktif"}</div>
          </div>
          <div className="resultsControls">
            <strong>{filtered.length} çağrı bulundu</strong>
            <div className="toolbarActions">
              <a href={`/api/v1/exports/calls.csv?${exportQuery}`}><FileDown size={15} /> CSV</a>
              <a href={`/api/v1/exports/calls.xlsx?${exportQuery}`}><FileDown size={15} /> Excel</a>
              <a href={`/api/v1/exports/calls.pdf?${exportQuery}`}><FileDown size={15} /> PDF</a>
            </div>
          </div>
          {loading && !model.calls.length ? <CallCardSkeleton /> : (
            <div className="cardGrid">
              {filtered.map((call) => <CallCard key={call.id} call={call} mode="link" />)}
              {!filtered.length && <EmptyState title="Çağrı bulunamadı" text="Arama ya da filtre seçeneklerini genişleterek tekrar deneyin." />}
            </div>
          )}
        </div>
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
    if (navigator.share) {
      await navigator.share({ title: call.title, text: shareText, url: shareUrl });
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
    ["Toplam bütçe", call.budgetMax ? `${call.budgetMax.toLocaleString("tr-TR")} ${call.currency || ""}` : ""],
    ["Destek oranı", call.supportRate ? `%${call.supportRate}` : ""],
    ["Başvuru dili", call.language?.toLocaleUpperCase("tr-TR")],
    ["Uygun ülkeler", call.eligibleCountries?.join(", ")],
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
          <h1>{call.title}</h1>
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
            {call.officialUrl && <a href={call.officialUrl} target="_blank" rel="noopener noreferrer">Resmî Çağrı Metnini Görüntüle <ArrowUpRight size={15} /></a>}
            {call.guideUrl && <a href={call.guideUrl} target="_blank" rel="noopener noreferrer">Başvuru Rehberini Görüntüle <ArrowUpRight size={15} /></a>}
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
          {!closed && (call.applicationUrl || call.url) && <a className="primaryAction quickApply" href={call.applicationUrl || call.url} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={18} /> Başvuru Yap</a>}
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
            <p className="leadText">{call.purpose || call.description || call.summary || "Bu çağrı, resmî kaynakta belirtilen kapsamda proje, araştırma veya iş birliği faaliyetlerini desteklemeyi amaçlar."}</p>
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
              <DetailItem label="Para birimi" value={call.currency} />
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
              {requiredDocuments(call).map((doc) => <article key={doc.name}><FileText size={18} /><div><strong>{doc.name}</strong><span>{doc.required ? "Zorunlu" : "Çağrı koşullarına bağlı"}</span>{doc.description && <p>{doc.description}</p>}</div>{doc.templateUrl && <a href={doc.templateUrl} target="_blank" rel="noopener noreferrer">Şablon</a>}</article>)}
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
              {call.officialUrl && <a className="primaryAction" href={call.officialUrl} target="_blank" rel="noopener noreferrer">Resmî Kaynak <ArrowUpRight size={15} /></a>}
              {call.guideUrl && <a href={call.guideUrl} target="_blank" rel="noopener noreferrer">Başvuru Rehberi <ArrowUpRight size={15} /></a>}
              <a href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar</a>
              <a href={links.outlook} target="_blank" rel="noopener noreferrer">Outlook</a>
              <a href={links.ics}>ICS indir</a>
            </div>
          </section>
          <section className="detailBlock">
            <h2>İletişim Bilgileri</h2>
            <div className="contactCard">
              <DetailItem label="Kurum" value={call.institution || call.funder} />
              {call.contacts?.map((contact, index) => <div key={index} className="contactLinks">{contact.email && <a href={`mailto:${contact.email}`}><Mail size={15} /> {contact.email}</a>}{contact.phone && <a href={`tel:${contact.phone}`}><MessageCircle size={15} /> {contact.phone}</a>}{contact.website && <a href={contact.website} target="_blank" rel="noopener noreferrer">Web sitesi</a>}</div>)}
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
  if (call.targetAudience?.length) return call.targetAudience;
  const text = `${call.title} ${call.summary} ${call.category}`.toLocaleLowerCase("tr-TR");
  const groups = [];
  if (/öğrenci|student|doctoral|doktora/.test(text)) groups.push("Öğrenciler ve doktora araştırmacıları");
  if (/akadem|üniversite|university|researcher|araştırmac/.test(text)) groups.push("Akademisyenler ve araştırmacılar");
  if (/kobi|sme|firma|şirket|company|startup|girişim/.test(text)) groups.push("KOBİ'ler, girişimler ve şirketler");
  if (/kamu|belediye|public/.test(text)) groups.push("Kamu kurumları ve yerel yönetimler");
  return groups.length ? groups : [targetAudience(call)];
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
          <article key={category}><WalletCards size={26} /><strong>{category}</strong><p>{count} açık çağrı bu alanda listeleniyor.</p><a href={`/cagrilar?category=${encodeURIComponent(category)}`}>Çağrıları Gör</a></article>
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
        <aside><h3>Filtreler</h3><label><input type="checkbox" defaultChecked /> TÜBİTAK</label><label><input type="checkbox" defaultChecked /> Avrupa</label><label><input type="checkbox" defaultChecked /> Uluslararası</label></aside>
        <div className="calendarList">
          <div className="calendarMonth"><CalendarDays size={22} /><strong>{monthLabel()}</strong></div>
          {urgent.slice(0, 20).map((call) => (
            <a key={call.id} className="calendarRow" href={callPath(call)} onClick={(event) => { event.preventDefault(); navigate(callPath(call)); }}>
              <span>{formatDate(call.deadline)}</span><strong>{call.title}</strong><em>{urgencyLabel(call)}</em>
            </a>
          ))}
          {!urgent.length && <p className="emptyInline">Takvimde yaklaşan çağrı bulunamadı.</p>}
        </div>
      </div>
    </section>
  );
}

function GuidePage() {
  usePageMeta("Proje Rehberi | Hibe Rota", "Proje başvurusu hazırlamak için çağrı okuma, bütçe, ortaklık ve yazım rehberi.");
  return (
    <>
      <Breadcrumb items={[{ label: "Proje Rehberi" }]} />
      <section className="content guideSection">
        <GuideContent />
      </section>
    </>
  );
}

function GuideArticlePage({ route }) {
  const slug = decodeURIComponent(route.pathname.replace("/rehber/", ""));
  const article = guideCards.find((card) => card.slug === slug);
  usePageMeta(`${article?.title || "Rehber Yazısı"} | Hibe Rota`, article?.text || "Proje başvuru rehberi makalesi.");
  if (!article) return <NotFoundPage />;
  const related = guideCards.filter((card) => card.slug !== article.slug).slice(0, 3);
  return (
    <>
      <Breadcrumb items={[{ label: "Proje Rehberi", href: "/rehber" }, { label: article.title }]} />
      <article className="content articlePage">
        <header className="articleHeader">
          <span>{article.tag}</span>
          <h1>{article.title}</h1>
          <p>{article.text}</p>
          <div><Clock3 size={16} /> {article.time} okuma</div>
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

function GuideContent() {
  return (
    <>
      <div className="guideHero">
        <h1>Proje Başvuru Rehberi</h1>
        <p>Araştırma ve yenilik projelerinizi başarıyla hazırlamak, bütçelendirmek ve yönetmek için kapsamlı bilgi merkezi.</p>
        <label><Search size={21} /><input placeholder="Rehberde arayın: bütçe, TRL, ortaklık..." aria-label="Rehberde ara" /></label>
      </div>
      <div className="guideLayout">
        <nav aria-label="Rehber kategorileri">{["Tüm Kategoriler", "Çağrı Okuma", "Proje Yazımı", "Bütçe Hazırlama", "Ortaklık Kurma", "Değerlendirme Süreci"].map((item, index) => <a key={item} className={index === 0 ? "active" : ""} href="/rehber">{item}</a>)}</nav>
        <div className="guideCards">
          {guideCards.map((card) => (
            <GuideCard key={card.slug} card={card} />
          ))}
        </div>
      </div>
      <div className="glossary">
        <h2><BookOpen size={27} /> Proje Terimleri Sözlüğü</h2>
        <div><p><strong>Ar-Ge</strong> Bilgi dağarcığını artırmak için yürütülen sistematik yaratıcı çalışmalar.</p><p><strong>TRL</strong> Teknolojinin olgunluğunu 1 ile 9 arasında değerlendiren seviye sistemi.</p><p><strong>Hibe / Eş Finansman</strong> Proje maliyetinin bir kısmının fon sağlayıcı tarafından karşılanması.</p></div>
      </div>
    </>
  );
}

function StaticPage({ type }) {
  const pages = {
    "/hakkimizda": ["Hakkımızda", "Hibe Rota, ulusal ve uluslararası destek çağrılarını tek noktada izlenebilir hale getiren üyelik gerektirmeyen bir bilgilendirme platformudur.", "Canlı kaynak taraması, export, RSS ve takvim çıktılarıyla başvuru ekiplerinin güncel fırsatları kaçırmamasını hedefler."],
    "/iletisim": ["İletişim", "Platformla ilgili geri bildirim, kaynak önerisi ve kurumsal iletişim için bizimle paylaşım yapabilirsiniz.", "E-posta: bilgi@projedestekportali.local"],
    "/sss": ["Sıkça Sorulan Sorular", "Veriler nereden geliyor?", "Çağrılar TÜBİTAK, Avrupa ve uluslararası açık kaynaklardan saatlik cache düzeniyle yenilenir."],
    "/gizlilik-politikasi": ["Gizlilik Politikası", "Bu sürüm üyelik gerektirmez ve kullanıcı hesabı oluşturmaz.", "Arama ve filtre tercihleri yalnızca URL parametreleriyle çalışır; kişisel veri saklanmaz."],
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

function AdminPage({ model, errors, fetchedAt }) {
  usePageMeta("Admin | Hibe Rota", "Kaynak sağlığı, manuel inceleme ve otomasyon özet ekranı.");
  const openCalls = model.openCalls.length;
  const manualReview = model.calls.filter((call) => call.requiresManualReview).length;
  const lowConfidence = model.calls.filter((call) => (call.confidenceScore || 0) < 75).length;
  return (
    <>
      <Breadcrumb items={[{ label: "Admin" }]} />
      <PageHero eyebrow="Admin" title="Otomasyon Yönetimi" text="Kaynak sağlığı, kalite sinyalleri ve kuyruk durumu için operasyon ekranı." />
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
  const { calls, errors, fetchedAt, loading, refresh } = useCalls();
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      query: params.get("q") || "",
      scope: queryToScope(params.get("scope")),
      status: params.get("status") || "open",
      category: params.get("category") || "",
      funder: params.get("funder") || "",
      deadlineWithin: params.get("deadlineWithin") || "",
      sort: params.get("sort") || "deadline_asc",
    };
  });

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
      deadlineWithin: params.has("deadlineWithin") ? params.get("deadlineWithin") : (route.pathname === "/cagrilar/yaklasan" ? "45" : current.deadlineWithin),
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
    indexedCalls.forEach((call) => {
      funderCounts.set(call.funder, (funderCounts.get(call.funder) || 0) + 1);
      categoryCounts.set(call.category || "Genel", (categoryCounts.get(call.category || "Genel") || 0) + 1);
    });
    const funders = [...funderCounts.entries()].sort((a, b) => b[1] - a[1]);
    const categories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
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
      urgentWeek,
    };
  }, [calls]);

  let page;
  if (route.pathname === "/") page = <HomePage model={model} filters={filters} setFilters={setFilters} />;
  else if (route.pathname === "/cagrilar" || route.pathname === "/cagrilar/ulusal" || route.pathname === "/cagrilar/avrupa" || route.pathname === "/cagrilar/uluslararasi" || route.pathname === "/cagrilar/yaklasan" || route.pathname === "/cagrilar/yeni") page = <CallsPage route={route} model={model} filters={filters} setFilters={setFilters} refresh={refresh} loading={loading} fetchedAt={fetchedAt} errors={errors} />;
  else if (route.pathname.startsWith("/cagrilar/") || route.pathname.startsWith("/cagri/")) page = <CallDetailPage route={route} model={model} />;
  else if (route.pathname === "/programlar") page = <ProgrammesPage model={model} />;
  else if (route.pathname.startsWith("/program/")) page = <ProgrammeDetailPage route={route} model={model} />;
  else if (route.pathname === "/kurumlar") page = <FundersPage model={model} />;
  else if (route.pathname.startsWith("/kurum/")) page = <FunderDetailPage route={route} model={model} />;
  else if (route.pathname === "/takvim") page = <CalendarPage model={model} />;
  else if (route.pathname === "/rehber") page = <GuidePage />;
  else if (route.pathname.startsWith("/rehber/")) page = <GuideArticlePage route={route} />;
  else if (route.pathname === "/admin") page = <AdminPage model={model} errors={errors} fetchedAt={fetchedAt} />;
  else if (["/hakkimizda", "/iletisim", "/sss", "/gizlilik-politikasi", "/kullanim-kosullari"].includes(route.pathname)) page = <StaticPage type={route.pathname} />;
  else page = <NotFoundPage />;

  return (
    <div className="appShell">
      <Header route={route} />
      <main>{page}</main>
      <Footer />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
