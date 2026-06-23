import { buildPublicUrl, escapeHtml, signSubscriberToken } from "../subscription-utils.mjs";

function fromAddress() {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL;
  const name = process.env.EMAIL_FROM_NAME || "Hibe Rota";
  const address = process.env.EMAIL_FROM_ADDRESS || "bildirim@hiberota.com";
  return `${name} <${address}>`;
}

function baseLayout({ title, body, preferencesUrl, unsubscribeUrl }) {
  return `<!doctype html>
<html lang="tr">
  <body style="margin:0;background:#f6f8fb;color:#0b1c30;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dce3ea;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:22px 28px;background:#0b1c30;color:#ffffff;"><strong style="font-size:18px;">Hibe Rota</strong></td></tr>
          <tr><td style="padding:28px 28px 8px;"><h1 style="margin:0;font-size:24px;line-height:32px;">${escapeHtml(title)}</h1></td></tr>
          <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:24px;">${body}</td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #e6edf5;font-size:12px;line-height:18px;color:#506070;">
            Hibe Rota, destek programlarını sizin için derler. Başvurular ilgili kurumların resmî internet siteleri üzerinden gerçekleştirilir.<br>
            <a href="${buildPublicUrl("/cagrilar")}">Tüm güncel çağrıları gör</a> · <a href="${preferencesUrl}">Bildirim tercihlerini değiştir</a> · <a href="${unsubscribeUrl}">Abonelikten ayrıl</a> · <a href="${buildPublicUrl("/gizlilik-politikasi")}">Gizlilik</a><br>
            İletişim: ${escapeHtml(process.env.RESEND_REPLY_TO || process.env.EMAIL_REPLY_TO || "destek@hiberota.com")}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function links(subscriber) {
  const token = signSubscriberToken(subscriber.id);
  return {
    preferencesUrl: buildPublicUrl(`/abonelik-tercihleri?token=${encodeURIComponent(token)}`),
    unsubscribeUrl: buildPublicUrl(`/abonelikten-cik?token=${encodeURIComponent(token)}`),
  };
}

export function buildVerificationEmail({ subscriber, verificationToken }) {
  const verifyUrl = buildPublicUrl(`/api/v1/subscriptions/confirm?token=${encodeURIComponent(verificationToken)}`);
  const { preferencesUrl, unsubscribeUrl } = links(subscriber);
  return {
    subject: "Hibe Rota aboneliğinizi doğrulayın",
    html: baseLayout({
      title: "Aboneliğinizi doğrulayın",
      preferencesUrl,
      unsubscribeUrl,
      body: `<p>Yeni proje destek çağrılarını e-posta ile almak için aboneliğinizi doğrulayın.</p>
        <p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;padding:14px 18px;font-weight:bold;min-height:44px;">Aboneliğimi Onayla</a></p>
        <p>Bu bağlantı 60 dakika geçerlidir. Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`,
    }),
  };
}

export function buildInstantCallEmail({ subscriber, call }) {
  const { preferencesUrl, unsubscribeUrl } = links(subscriber);
  const detailUrl = buildPublicUrl(`/cagrilar/${encodeURIComponent(call.slug || call.id)}`);
  const officialUrl = call.officialUrl || call.applicationUrl || call.url || detailUrl;
  return {
    subject: `Yeni çağrı: ${call.title || "Proje desteği"}`,
    html: baseLayout({
      title: call.title || "Yeni proje çağrısı",
      preferencesUrl,
      unsubscribeUrl,
      body: `<p><strong>Fon sağlayıcı:</strong> ${escapeHtml(call.funder || call.institution || "Belirtilmedi")}</p>
        <p><strong>Son tarih:</strong> ${escapeHtml(call.deadline || "Belirtilmedi")}</p>
        <p><strong>Destek tutarı:</strong> ${escapeHtml(call.support || call.budgetMax || "Çağrı metninde belirtilir")}</p>
        <p><strong>Uygun başvuru sahipleri:</strong> ${escapeHtml([...(call.targetAudience || []), ...(call.eligibleInstitutions || [])].join(", ") || "Çağrı metninde belirtilir")}</p>
        <p>${escapeHtml(call.summary || call.description || "Hibe Rota bu çağrıyı doğrulanmış kaynaklardan yakaladı.")}</p>
        <p><a href="${detailUrl}">Hibe Rota detayları</a> · <a href="${officialUrl}">Resmî kaynak</a></p>`,
    }),
  };
}

function digestBody(calls = [], intro) {
  const items = calls.map((call) => {
    const detailUrl = buildPublicUrl(`/cagrilar/${encodeURIComponent(call.slug || call.id)}`);
    const officialUrl = call.officialUrl || call.applicationUrl || call.url || detailUrl;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e1e8f0;border-radius:8px;margin:0 0 14px;">
      <tr><td style="padding:16px;">
        <p style="margin:0 0 4px;color:#526174;font-size:13px;">${escapeHtml(call.funder || call.institution || "Kurum belirtilmedi")}</p>
        <h2 style="margin:0 0 8px;font-size:18px;line-height:24px;">${escapeHtml(call.title || "Çağrı")}</h2>
        <p style="margin:0 0 10px;color:#24364b;">${escapeHtml(call.summary || call.description || "Yeni destek fırsatı")}</p>
        <p style="margin:0 0 12px;font-size:13px;color:#3b4d63;">
          <strong>Destek:</strong> ${escapeHtml(call.support || call.category || call.scope || "Çağrı metninde belirtilir")}<br>
          <strong>Hedef kitle:</strong> ${escapeHtml([...(call.targetAudience || []), ...(call.eligibleInstitutions || [])].join(", ") || call.audience || "Çağrı metninde belirtilir")}<br>
          <strong>Son başvuru:</strong> ${escapeHtml(call.deadlineLabel || call.deadline || "Tarih bekleniyor")} ${call.daysLeft != null ? `(${escapeHtml(call.daysLeft)} gün kaldı)` : ""}
        </p>
        <a href="${officialUrl}" style="display:inline-block;background:#0b1c30;color:#fff;text-decoration:none;border-radius:6px;padding:12px 16px;font-weight:bold;min-height:44px;">Çağrıyı İncele</a>
      </td></tr>
    </table>`;
  }).join("");
  return `<p>${escapeHtml(intro)}</p><p>Hibe Rota’da son dönemde yayınlanan ve başvuruya açılan yeni hibe, fon, teşvik ve proje çağrılarını sizin için derledik.</p>${items}<p><a href="${buildPublicUrl("/cagrilar")}">Tüm güncel çağrıları gör</a></p>`;
}

export function buildDigestEmail({ subscriber, calls = [], period = "DAILY" }) {
  const { preferencesUrl, unsubscribeUrl } = links(subscriber);
  return {
    subject: period === "MONTHLY" ? "Ayın proje çağrıları" : period === "WEEKLY" ? "Haftanın proje çağrıları" : "Bugünün proje çağrıları",
    html: baseLayout({
      title: "Yeni Destek Fırsatlarını Keşfedin",
      preferencesUrl,
      unsubscribeUrl,
      body: digestBody(calls, `${calls.length} yeni çağrı tercihlerinize uygun görünüyor.`),
    }),
  };
}

export function buildUnsubscribeConfirmationEmail({ subscriber }) {
  const { preferencesUrl, unsubscribeUrl } = links(subscriber);
  return {
    subject: "Hibe Rota aboneliğiniz sonlandırıldı",
    html: baseLayout({
      title: "Abonelikten çıktınız",
      preferencesUrl,
      unsubscribeUrl,
      body: "<p>Hibe Rota e-posta bildirimleri bu adres için durduruldu.</p>",
    }),
  };
}

export function createResendProvider() {
  async function send({ to, subject, html, headers = {} }) {
    if (process.env.EMAIL_NOTIFICATION_ENABLED === "false") {
      return { id: `disabled_${Date.now()}`, skipped: true };
    }
    if (!process.env.RESEND_API_KEY) {
      return { id: `dev_${Date.now()}`, skipped: true };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), reply_to: process.env.RESEND_REPLY_TO || process.env.EMAIL_REPLY_TO || undefined, to, subject, html, headers }),
    });
    if (!response.ok) throw new Error(`resend_send_failed_${response.status}`);
    return response.json();
  }

  return {
    async sendVerificationEmail({ subscriber, verificationToken }) {
      const email = buildVerificationEmail({ subscriber, verificationToken });
      return send({ to: subscriber.email, ...email, headers: unsubscribeHeaders(subscriber) });
    },
    async sendInstantCallAlert({ subscriber, call }) {
      const email = buildInstantCallEmail({ subscriber, call });
      return send({ to: subscriber.email, ...email, headers: unsubscribeHeaders(subscriber) });
    },
    async sendDailyDigest({ subscriber, calls }) {
      const email = buildDigestEmail({ subscriber, calls, period: "DAILY" });
      return send({ to: subscriber.email, ...email, headers: unsubscribeHeaders(subscriber) });
    },
    async sendWeeklyDigest({ subscriber, calls }) {
      const email = buildDigestEmail({ subscriber, calls, period: "WEEKLY" });
      return send({ to: subscriber.email, ...email, headers: unsubscribeHeaders(subscriber) });
    },
    async sendMonthlyDigest({ subscriber, calls }) {
      const email = buildDigestEmail({ subscriber, calls, period: "MONTHLY" });
      return send({ to: subscriber.email, ...email, headers: unsubscribeHeaders(subscriber) });
    },
    async sendUnsubscribeConfirmation({ subscriber }) {
      const email = buildUnsubscribeConfirmationEmail({ subscriber });
      return send({ to: subscriber.email, ...email });
    },
  };
}

function unsubscribeHeaders(subscriber) {
  const url = buildPublicUrl(`/api/v1/subscriptions/unsubscribe?token=${encodeURIComponent(signSubscriberToken(subscriber.id))}`);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
