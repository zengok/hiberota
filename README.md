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

## Notlar

- Tarayici saat basinda veri yeniler.
- Sunucu resmi kaynaklari 1 saat cache'ler.
- Otomasyon adapter, confidence, manual review, source health ve audit bilgilerini `.hiberota/automation-state.json` icinde tutar.
- Deployment notlari: `docs/ARGE_VE_CANLIYA_ALMA.md`
- Otomasyon mimarisi: `docs/AUTOMATION_ARCHITECTURE.md`
