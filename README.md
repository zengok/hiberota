# Hibe Rota

Ulusal, Avrupa ve yurtdisi Ar-Ge/proje destek cagrilarini tek dashboardda izleyen web uygulamasi.

## Gelistirme

```bash
npm install
npm run dev
```

Uygulama:

```text
http://127.0.0.1:5173
```

## Production

```bash
npm ci
npm run build
npm start
```

Health check:

```text
/healthz
```

Canli cagri API:

```text
/api/calls
```

## Ortam Degiskenleri

Minimum production ayarlari:

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=5173
ADMIN_API_TOKEN=<uzun-rastgele-token>
DATABASE_PATH=.hiberota/database.sqlite
DATABASE_BACKUP_DIR=.hiberota/backups
```

`ADMIN_API_TOKEN` production ortaminda zorunludur. Admin istekleri `Authorization: Bearer <token>` header'i ile yapilir; query string token kabul edilmez.

## Database ve Backup

SQLite varsayilan olarak `.hiberota/database.sqlite` dosyasini kullanir. Path `DATABASE_PATH` ile degistirilebilir. Uygulama acilista migration dosyalarini otomatik uygular, WAL ve foreign key destegini acar.

Manuel backup:

```bash
npm run db:backup
```

Backup hedefi `DATABASE_BACKUP_DIR` ile ayarlanir.

## Docker

```bash
docker compose up --build app
```

Opsiyonel worker profili:

```bash
docker compose --profile worker up --build
```

Opsiyonel PostgreSQL profili ileride repository adapter gecisi icin hazirdir:

```bash
docker compose --profile postgres up -d postgres
```

Container root kullanici ile calismaz ve `/healthz` healthcheck tanimlidir.

## CI/CD

GitHub Actions workflow su kontrolleri calistirir:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- Docker build
- Trivy image scan
- CodeQL

Branch protection icin onerilen required check isimleri:

- `lint test build audit`
- `docker build and scan`
- `codeql`

Dependabot npm ve GitHub Actions paketlerini haftalik kontrol eder.

## Troubleshooting

- Production baslamiyorsa once `ADMIN_API_TOKEN` degerinin set edildigini kontrol et.
- Veritabani kilitlenirse `.hiberota` volume/dizin izinlerini ve `DATABASE_PATH` degerini kontrol et.
- Public API bos donerse `/healthz`, `/api/v1/automation/metrics` ve source health alanlarini kontrol et.
- Eski uyumluluk endpointi `/api/calls`, yeni liste endpointi `/api/v1/calls` olarak korunur.

## Notlar

- Tarayici saat basinda veri yeniler.
- Sunucu resmi kaynaklari 1 saat cache'ler.
- Otomasyon adapter, confidence, manual review, source health ve audit bilgilerini SQLite icinde tutar; eski `.hiberota/automation-state.json` varsa otomatik ice aktarilir.
- Deployment notlari: `docs/ARGE_VE_CANLIYA_ALMA.md`
- Otomasyon mimarisi: `docs/AUTOMATION_ARCHITECTURE.md`
