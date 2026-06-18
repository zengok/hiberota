# Hibe Rota Otomasyon Mimarisi

Bu doküman, canlı çağrı yakalama otomasyonunun mevcut Express/React yapısı bozulmadan nasıl genişletildiğini açıklar.

## Mevcut Teknik Analiz

- Backend: Node.js, Express 5, Cheerio tabanlı kaynak okuma, Vite middleware/production static servis.
- Frontend: React 19, Vite, tek sayfalı uygulama.
- Veri tabanı: Otomasyon state ve çağrı kayıtları varsayılan olarak `.hiberota/database.sqlite` içinde saklanır; eski `.hiberota/automation-state.json` dosyası varsa otomatik içeri alınır.
- Mevcut canlı API: `/api/calls`, `/api/v1/calls`, export, RSS, calendar ICS endpointleri korunmuştur.
- Takip edilen aktif kaynaklar: TÜBİTAK, Ufuk Avrupa Türkiye, Eureka, Euresearch, EuroAccess, Grants.gov, TÜSEB.
- Yayınlama akışı: Uygun confidence ve kalite filtresinden geçen kayıtlar API’de görünür; düşük güven ve belirsiz kayıtlar manuel inceleme kuyruğuna yazılır.

## Eklenen Katmanlar

- Merkezi kaynak kayıt sistemi: `SOURCE_REGISTRY`.
- Adapter sarmalayıcıları: Her kaynak `discoverListPages`, `extractStructuredData`, `normalizeData`, `detectChanges` metodlarıyla çalışır.
- Tarih motoru: Türkçe/İngilizce tarihleri, saat bilgisini ve kanıt metnini çıkarır.
- Destek ve bütçe motoru: Çağrı metnindeki hibe/destek tutarı, bütçe üst limiti, para birimi ve destek oranını yapılandırılmış alanlara (`budgetMax`, `currency`, `supportRate`) dönüştürür.
- Durum motoru: `OPEN`, `CLOSING_SOON`, `EXTENDED`, `CANCELLED`, `PAUSED`, `CLOSED`, `UNKNOWN` gibi normalize durum üretir.
- İçerik hash: Normalize edilmiş içerikten SHA-256 hash oluşturulur.
- Değişiklik takibi: Deadline, durum, bütçe, destek oranı, başvuru URL’si, guide URL ve hash değişimleri audit log’a yazılır.
- Duplicate tespiti: Çağrı kodu, external ID, resmi URL ve normalize başlık/deadline tabanlı eşleştirme yapılır.
- Confidence score: 0-100 arası güven puanı üretilir.
- Evidence: Deadline, status ve resmi URL için kaynak metin ve güven bilgisi saklanır.
- Manuel inceleme kuyruğu: Eksik deadline, düşük güven, duplicate, bozuk link, iptal/süre uzatma sinyalleri sıraya düşer.
- Link doğrulama: Resmi, başvuru, rehber ve ek doküman linkleri düşük öncelikli arka plan worker ile kontrol edilir; ana çağrı toplama döngüsünü bekletmez.
- Kaynak sağlık takibi: Başarılı/başarısız crawl zamanı, ardışık hata sayısı, ortalama süre ve health status tutulur.
- Kalıcı queue snapshot: Job tipleri, idempotency key, retry/timeout metadata, pending/running/processed kayıtları ve dead-letter alanları SQLite state içine yazılır; restart sonrası bekleyen işler geri yüklenir.

## Yeni API Endpointleri

- `GET /api/v1/automation/sources`
- `GET /api/v1/automation/metrics`
- `GET /api/v1/automation/manual-review`
- `POST /api/v1/automation/manual-review/:id/:action`
- `GET /api/v1/automation/change-log`
- `GET /api/v1/automation/link-health`
- `GET /api/v1/automation/jobs`

## Environment Variable

- `AUTOMATION_STATE_PATH`: State dosyası konumu.
- `CRAWLER_CONCURRENCY`: Queue concurrency değeri.
- `CRAWLER_JOB_TIMEOUT_MS`: Job timeout değeri.
- `ENABLE_DEEP_SCRAPING`: Detay sayfası olan kaynaklarda bütçe/oran gibi alanları tamamlamak için detay metni taramasını açar; `false` yapılırsa liste seviyesiyle sınırlanır.
- `LINK_VERIFY_LIMIT`: Her taramada doğrulanacak maksimum link sayısı.
- `LINK_VERIFY_TIMEOUT_MS`: Link doğrulama isteği timeout değeri.
- `LINK_HEALTH_WORKER_DELAY_MS`: Çağrı toplama sonrası link worker başlatma gecikmesi.
- `LINK_HEALTH_WORKER_LIMIT`: Worker başına doğrulanacak maksimum link sayısı.
- `LINK_HEALTH_MAX_AGE_MS`: Manuel inceleme için geçerli kabul edilen link kontrol yaşı.
- `CONFIDENCE_AUTO_PUBLISH_MIN`: Otomatik yayın eşiği.
- `CONFIDENCE_MANUAL_REVIEW_MIN`: Minimum yayın/gözden geçirme eşiği.
- `CRAWL_FREQ_TUBITAK_MIN`
- `CRAWL_FREQ_TUSEB_MIN`
- `CRAWL_FREQ_EU_MIN`
- `CRAWL_FREQ_INTL_MIN`

## Testler

`npm test` aşağıdaki alanları kapsar:

- Tarih parse
- Destek miktarı, bütçe ve destek oranı çıkarımı
- Status hesaplama
- Sayfa türü sınıflandırma
- Hash üretme
- Duplicate tespiti
- Veri normalizasyonu
- URL güvenlik kontrolü

## Migration

Kalıcı DB’ye geçiş için `docs/migrations/001_automation_tables.sql` dosyasında geri alınabilir tablo taslağı bulunur:

- `sources`
- `source_crawl_logs`
- `call_sources`
- `call_versions`
- `call_change_logs`
- `call_evidence`
- `manual_review_queue`
- `crawler_jobs`
- `link_health_checks`

## Bilinen Sınırlamalar

- Bu sürüm üyelik veya kullanıcı yönetimi eklemez.
- AI entegrasyonu bilinçli olarak bağlanmadı; kurallar yeterli güven sağlamadığında kayıt manuel incelemeye düşer.
- PDF/DOCX metin çıkarma için migration ve veri modeli hazırdır, ancak ek bağımlılık kullanılmadan tam PDF parser eklenmemiştir.
- Queue süreç içinde çalışır ancak snapshot’ı SQLite state içinde tutulur; çok instance production’da Redis/BullMQ veya gerçek worker tablosuna taşınmalıdır.
- SQLite state tek instance için uygundur; çok instance production’da DB migration kullanılmalıdır.
