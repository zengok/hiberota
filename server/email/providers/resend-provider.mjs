import { buildPublicUrl, escapeHtml, signSubscriberToken } from "../subscription-utils.mjs";

function fromAddress() {
  const name = process.env.EMAIL_FROM_NAME || "Hibe Rota";
  const address = process.env.EMAIL_FROM_ADDRESS || "bildirim@bildirim.hiberota.com";
  return `${name} <${address}>`;
}

function baseLayout({ title, body, preferencesUrl, unsubscribeUrl }) {
  return `<!doctype html>
<html lang="tr">
  <body style="margin:0;background:#f6f8fb;color:#0b1c30;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dce3ea;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:28px 28px 8px;"><h1 style="margin:0;font-size:24px;line-height:32px;">${escapeHtml(title)}</h1></td></tr>
          <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:24px;">${body}</td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #e6edf5;font-size:12px;line-height:18px;color:#506070;">
            Hibe Rota bildirimleri. <a href="${preferencesUrl}">Tercihler</a> · <a href="${unsubscribeUrl}">Abonelikten çık</a> · <a href="${buildPublicUrl("/gizlilik-politikasi")}">Gizlilik</a>
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
        <p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:bold;">Aboneliği doğrula</a></p>
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
  const items = calls.slice(0, 15).map((call) => `<li><strong>${escapeHtml(call.title || "Çağrı")}</strong><br>${escapeHtml(call.funder || "")} · ${escapeHtml(call.deadline || "Tarih bekleniyor")}</li>`).join("");
  return `<p>${escapeHtml(intro)}</p><ul style="padding-left:20px;">${items}</ul><p><a href="${buildPublicUrl("/cagrilar/yeni")}">Tüm yeni çağrıları göster</a></p>`;
}

export function buildDigestEmail({ subscriber, calls = [], period = "DAILY" }) {
  const { preferencesUrl, unsubscribeUrl } = links(subscriber);
  return {
    subject: period === "WEEKLY" ? "Haftanın yeni proje çağrıları" : "Bugünün yeni proje çağrıları",
    html: baseLayout({
      title: period === "WEEKLY" ? "Haftanın yeni çağrıları" : "Günün yeni çağrıları",
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
      body: JSON.stringify({ from: fromAddress(), to, subject, html, headers }),
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
