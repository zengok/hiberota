# Email Notifications

Hibe Rota e-posta bildirimleri kullanıcı hesabı olmadan, yalnızca e-posta adresiyle çalışır. Kayıt double opt-in doğrulama gerektirir; doğrulanmamış, unsubscribed, bounced veya complained abonelere çağrı bildirimi gönderilmez.

## Environment

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=Hibe Rota <bildirim@hiberota.com>
RESEND_REPLY_TO=destek@hiberota.com
RESEND_WEBHOOK_SECRET=
CRON_SECRET=
APP_URL=https://hiberota.com
EMAIL_NOTIFICATION_ENABLED=true
EMAIL_NOTIFICATION_CONFIDENCE_MIN=80
TURNSTILE_SECRET_KEY=
```

API key yalnızca server ortamında tutulur. Frontend bundle'a eklenmez.

## Resend Setup

1. Resend hesabında gönderim domainini ekleyin.
2. DNS'e SPF, DKIM ve DMARC kayıtlarını girin.
3. `RESEND_FROM_EMAIL` için doğrulanmış domain altında `Hibe Rota <bildirim@hiberota.com>` adresini kullanın.
4. Webhook URL'sini `POST /api/webhooks/resend` olarak tanımlayın. Eski `/api/v1/email/webhooks/resend` yolu da uyumluluk için çalışır.
5. Resend webhook secret değerini `RESEND_WEBHOOK_SECRET` olarak kaydedin.

## Cron

Güvenli endpoint:

```bash
curl -X POST https://hiberota.com/api/cron/newsletter \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"frequency":"daily"}'
```

Zamanlama Europe/Istanbul saatine göre dış cron/systemd timer/VPS cron üzerinden yapılır:

- Günlük: her gün 09:00, `frequency=daily`
- Haftalık: her pazartesi 09:00, `frequency=weekly`
- Aylık: her ayın 1. günü 09:00, `frequency=monthly`

## Worker

E-posta işlemleri scraper içinde gönderilmez. Cron endpointi gerçek `calls` tablosundan yayınlanmış, linki geçerli, kapanmamış çağrıları seçer; `newsletter_runs` ile aynı periyotta tekrar gönderimi engeller.

## KVKK and IYS

Abonelik formu KVKK aydınlatma bağlantısı ve elektronik ileti onayı içerir. Metin versiyonu `consent_text_version`, IP ve user agent saklanır. Ticari elektronik ileti kapsamı ve İYS gereklilikleri hukuk/uyum ekibiyle ayrıca değerlendirilmelidir.

## Bounce and Complaint

Webhook üzerinden bounce olayı gelen aboneler `BOUNCED`, complaint olayı gelenler `COMPLAINED` yapılır. Bu statülerdeki aboneler yeni gönderimlere dahil edilmez.

## Backup

Bildirim tabloları ana SQLite veritabanındadır. Mevcut `npm run db:backup` akışı bu verileri de yedekler.
