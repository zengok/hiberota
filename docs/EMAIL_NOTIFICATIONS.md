# Email Notifications

Hibe Rota e-posta bildirimleri kullanıcı hesabı olmadan, yalnızca e-posta adresiyle çalışır. Kayıt double opt-in doğrulama gerektirir; doğrulanmamış, unsubscribed, bounced veya complained abonelere çağrı bildirimi gönderilmez.

## Environment

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM_NAME=Hibe Rota
EMAIL_FROM_ADDRESS=bildirim@bildirim.hiberota.com
APP_PUBLIC_URL=https://hiberota.com
EMAIL_WEBHOOK_SECRET=
EMAIL_NOTIFICATION_ENABLED=true
EMAIL_NOTIFICATION_CONFIDENCE_MIN=80
TURNSTILE_SECRET_KEY=
```

API key yalnızca server ortamında tutulur. Frontend bundle'a eklenmez.

## Resend Setup

1. Resend hesabında gönderim domainini ekleyin.
2. DNS'e SPF, DKIM ve DMARC kayıtlarını girin.
3. `EMAIL_FROM_ADDRESS` için doğrulanmış domain altında bir adres kullanın.
4. Webhook URL'sini `POST /api/v1/email/webhooks/resend` olarak tanımlayın.
5. Resend webhook secret değerini `EMAIL_WEBHOOK_SECRET` olarak kaydedin.

## Worker

E-posta işlemleri API request ve scraper içinde gönderilmez. API ve otomasyon yalnızca `notification_outbox`, `email_notifications` ve `email_digest_queue` kayıtları oluşturur. Üretimde Redis/BullMQ worker eklenebilir; mevcut geliştirme akışı SQLite outbox ile güvenli fallback sağlar.

## KVKK and IYS

Abonelik formu KVKK aydınlatma bağlantısı ve elektronik ileti onayı içerir. Metin versiyonu `consent_text_version`, IP ve user agent saklanır. Ticari elektronik ileti kapsamı ve İYS gereklilikleri hukuk/uyum ekibiyle ayrıca değerlendirilmelidir.

## Bounce and Complaint

Webhook üzerinden bounce olayı gelen aboneler `BOUNCED`, complaint olayı gelenler `COMPLAINED` yapılır. Bu statülerdeki aboneler yeni gönderimlere dahil edilmez.

## Backup

Bildirim tabloları ana SQLite veritabanındadır. Mevcut `npm run db:backup` akışı bu verileri de yedekler.
