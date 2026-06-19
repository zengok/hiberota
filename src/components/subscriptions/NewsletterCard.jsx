import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCircle2, Mail, X } from "lucide-react";

const DISMISSED_KEY = "hiberota_newsletter_dismissed_until";
const SUBSCRIBED_KEY = "hiberota_newsletter_subscribed";
const SESSION_KEY = "hiberota_newsletter_seen";

const interests = [
  "Ulusal",
  "Avrupa",
  "Uluslararası",
  "Öğrenci",
  "Akademisyen",
  "Araştırmacı",
  "Girişimci",
  "KOBİ",
  "Sağlık",
  "Yapay zekâ",
  "Dijital dönüşüm",
  "Çevre ve sürdürülebilirlik",
];

const frequencies = [
  { value: "INSTANT", label: "Anında" },
  { value: "DAILY", label: "Günlük" },
  { value: "WEEKLY", label: "Haftalık" },
];

function canShow() {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(SUBSCRIBED_KEY) === "1") return false;
  if (window.sessionStorage.getItem(SESSION_KEY) === "1") return false;
  const dismissedUntil = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
  return !dismissedUntil || dismissedUntil < Date.now();
}

export function NewsletterCard() {
  const [visible, setVisible] = useState(false);
  const [timerReady, setTimerReady] = useState(false);
  const [scrollReady, setScrollReady] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedInterests, setSelectedInterests] = useState(["Ulusal"]);
  const [frequency, setFrequency] = useState("DAILY");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const dialogRef = useRef(null);
  const titleId = useMemo(() => `newsletter-title-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimerReady(true), 8000);
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (window.scrollY / max >= 0.25) setScrollReady(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!visible && timerReady && scrollReady && canShow()) {
      setVisible(true);
      window.sessionStorage.setItem(SESSION_KEY, "1");
    }
  }, [timerReady, scrollReady, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const previous = document.activeElement;
    const focusable = () => [...dialogRef.current?.querySelectorAll("button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])") || []].filter((item) => !item.disabled);
    const first = focusable()[0];
    first?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [visible]);

  function close() {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now() + 14 * 24 * 60 * 60 * 1000));
    setVisible(false);
  }

  function toggleInterest(interest) {
    setSelectedInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!email || !consent) {
      setStatus("validation_error");
      return;
    }
    setStatus("submitting");
    try {
      const response = await fetch("/api/v1/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, interests: selectedInterests, frequency, consent, website }),
      });
      if (response.status === 202) {
        window.localStorage.setItem(SUBSCRIBED_KEY, "1");
        setStatus("confirmation_sent");
        return;
      }
      const data = await response.json().catch(() => ({}));
      setStatus(data.status === "already_subscribed" ? "already_subscribed" : "validation_error");
    } catch {
      setStatus("server_error");
    }
  }

  if (!visible) return null;

  return (
    <div className="newsletterOverlay" aria-hidden={false}>
      <section className="newsletterCard" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button className="newsletterClose" type="button" onClick={close} aria-label="Kapat">
          <X size={18} />
        </button>
        {status === "confirmation_sent" ? (
          <div className="newsletterSuccess">
            <CheckCircle2 size={30} />
            <h2 id={titleId}>Doğrulama e-postası gönderildi</h2>
            <p>Aboneliği tamamlamak için gelen kutunuzdaki bağlantıyı açın.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="newsletterForm">
            <div className="newsletterIcon"><Bell size={20} /></div>
            <h2 id={titleId}>Yeni proje çağrılarını kaçırmayın</h2>
            <p>Hibe Rota'nın yakaladığı ve doğruladığı yeni proje desteklerini e-posta ile alın.</p>
            <label>
              <span>E-posta adresi</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" required placeholder="ornek@kurum.com" />
            </label>
            <input className="newsletterHoneypot" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <div className="newsletterField">
              <span>İlgi alanı seçimi</span>
              <div className="newsletterChips">
                {interests.map((interest) => (
                  <button key={interest} type="button" className={selectedInterests.includes(interest) ? "selected" : ""} onClick={() => toggleInterest(interest)}>
                    {interest}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span>Bildirim sıklığı</span>
              <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                {frequencies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="newsletterConsent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span><a href="/gizlilik-politikasi">KVKK aydınlatma metnini</a> okudum, e-posta ile elektronik ileti almayı kabul ediyorum.</span>
            </label>
            {status === "validation_error" && <p className="newsletterError">E-posta adresini ve onay kutusunu kontrol edin.</p>}
            {status === "server_error" && <p className="newsletterError">Şu anda işlem tamamlanamadı. Lütfen tekrar deneyin.</p>}
            <button className="newsletterSubmit" type="submit" disabled={status === "submitting"}>
              <Mail size={18} />
              {status === "submitting" ? "Gönderiliyor" : "Abone ol"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
