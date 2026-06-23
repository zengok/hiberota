import fs from "node:fs";
import path from "node:path";

const DEFAULT_SITE_CONTENT = {
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
    articles: [
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
    ],
  },
};

function text(value, max = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/<[a-z/][^>]*>/gi, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function slug(value, fallback = "yazi") {
  const normalized = text(value, 120)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function url(value, max = 1000) {
  const candidate = text(value, max);
  if (!candidate) return "";
  if (candidate.startsWith("/") || candidate.startsWith("data:image/")) return candidate;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeArticle(article = {}, index = 0) {
  const title = text(article.title, 180) || `Rehber Yazısı ${index + 1}`;
  const articleSlug = slug(article.slug || title, `rehber-yazisi-${index + 1}`);
  return {
    slug: articleSlug,
    tag: text(article.tag, 80) || "Proje Rehberi",
    time: text(article.time, 30) || "10 dk",
    title,
    text: text(article.text, 500),
    coverImage: url(article.coverImage),
    sections: array(article.sections).slice(0, 16).map((section, sectionIndex) => ({
      title: text(section?.title, 180) || `Bölüm ${sectionIndex + 1}`,
      body: text(section?.body, 3500),
    })).filter((section) => section.body),
  };
}

export function normalizeSiteContent(content = {}) {
  const images = content.images || {};
  const home = content.home || {};
  const guide = content.guide || {};
  return {
    images: {
      logoSvg: url(images.logoSvg) || DEFAULT_SITE_CONTENT.images.logoSvg,
      logoPng: url(images.logoPng) || DEFAULT_SITE_CONTENT.images.logoPng,
      heroImage: url(images.heroImage),
    },
    home: {
      heroTitle: text(home.heroTitle, 180) || DEFAULT_SITE_CONTENT.home.heroTitle,
      heroText: text(home.heroText, 700) || DEFAULT_SITE_CONTENT.home.heroText,
      promoTitle: text(home.promoTitle, 180) || DEFAULT_SITE_CONTENT.home.promoTitle,
      promoText: text(home.promoText, 500) || DEFAULT_SITE_CONTENT.home.promoText,
    },
    guide: {
      heroTitle: text(guide.heroTitle, 180) || DEFAULT_SITE_CONTENT.guide.heroTitle,
      heroText: text(guide.heroText, 700) || DEFAULT_SITE_CONTENT.guide.heroText,
      categories: (array(guide.categories).length ? array(guide.categories) : DEFAULT_SITE_CONTENT.guide.categories).map((item) => text(item, 80)).filter(Boolean).slice(0, 12),
      glossary: (array(guide.glossary).length ? array(guide.glossary) : DEFAULT_SITE_CONTENT.guide.glossary).slice(0, 12).map((item) => ({
        term: text(item?.term, 80),
        definition: text(item?.definition, 500),
      })).filter((item) => item.term && item.definition),
      articles: (array(guide.articles).length ? array(guide.articles) : DEFAULT_SITE_CONTENT.guide.articles).slice(0, 80).map(normalizeArticle),
    },
  };
}

export function createSiteContentStore(filePath) {
  function read() {
    try {
      if (!fs.existsSync(filePath)) return normalizeSiteContent(DEFAULT_SITE_CONTENT);
      return normalizeSiteContent(JSON.parse(fs.readFileSync(filePath, "utf8")));
    } catch {
      return normalizeSiteContent(DEFAULT_SITE_CONTENT);
    }
  }

  function write(content) {
    const normalized = normalizeSiteContent(content);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
    return normalized;
  }

  return { read, write };
}
