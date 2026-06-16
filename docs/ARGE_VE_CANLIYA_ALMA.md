# Hibe Rota Ar-Ge ve Canliya Alma Calismasi

## Hedef

Hibe Rota, ulusal ve uluslararasi Ar-Ge destek cagrilarini tek ekranda izleyen, resmi kaynaklardan duzenli veri ceken ve kullanicinin basvuru firsatlarini hizli taramasini saglayan bir web uygulamasidir.

## Mevcut Durum

- React + Vite arayuz.
- Express tabanli API ve scraper katmani.
- Excel kaynak katalogundan uretilen 230 programlik seed veri.
- Canli kaynaklar: TUBITAK, Ufuk Avrupa, Eureka, Grants.gov, TUSEB.
- Kart tabanli UX: kart tiklaninca detay alani genisler.
- Kullanici tarafinda saat basinda otomatik yenileme.
- Sunucu tarafinda 1 saatlik ortak cache.

## Gelistirme Yol Haritasi

### 1. Veri Kalitesi

- Her kaynak icin ayri parser modulu olustur.
- Cagri detay sayfalarini ikinci seviye tarayarak butce, uygun basvuru sahibi, son tarih ve dokuman linklerini zenginlestir.
- Cagri kimligi, program kodu ve kurum bazli kalici eslestirme yap.
- Kapanan cagrilari arsivleyip trend analizi icin sakla.

### 2. Kullanici Degeri

- Favorilere ekleme.
- E-posta bildirimleri.
- Son 30 gun icinde acilan cagrilar.
- Sektor/tema bazli filtreleme.
- Kurum profili: KOBI, universite, STK, kamu, konsorsiyum.
- Basvuru takvimi ve iCal disari aktarim.

### 3. Operasyon ve Guvenilirlik

- Kaynak bazli health metriği.
- Parser hata loglari ve alarm.
- Cache hit/miss takibi.
- Rate limit ve robots.txt uyum kontrolu.
- Veritabani: PostgreSQL veya SQLite ile cagri gecmisi.

### 4. Canli Urun Mimarisi

Onerilen ilk canli mimari:

- Tek Node web service.
- `npm run build` ile Vite build.
- `npm start` ile Express sunucu.
- `/api/calls` canli veri endpointi.
- `/healthz` deploy health check.
- Sunucu cache TTL: 1 saat.

Bu mimari Render, Railway, Fly.io veya klasik VPS icin uygundur. Vercel kullanilacaksa API tarafinin serverless fonksiyonlara ayrilmasi gerekir.

## Yayina Alma Adimlari

1. Git reposunu olustur ve kodu push et.
2. Render/Railway/Fly uzerinde Node Web Service ac.
3. Build komutu: `npm ci && npm run build`
4. Start komutu: `npm start`
5. Health check path: `/healthz`
6. Ortam degiskenlerini `.env.example` dosyasina gore gir.
7. Domain bagla ve HTTPS etkinlestir.
8. Ilk deploydan sonra `/api/calls` ve `/healthz` endpointlerini kontrol et.

## Performans Notlari

- Static assetler production modda uzun sureli cache ile servis edilir.
- `index.html` no-cache kalir; boylece yeni deploylar tarayiciya yansir.
- API cevabi kisa sureli HTTP cache ve sunucu ici ortak cache kullanir.
- Her kullanici icin resmi kaynaklar yeniden taranmaz.

## Riskler

- Resmi kaynak HTML yapisi degisirse parser bozulabilir.
- Bazi portallar SPA veya oturumlu oldugu icin detaylar eksik gelebilir.
- Fon miktarlari her zaman liste sayfasinda bulunmaz; detay sayfasi/PDF tarama gerekir.
- Uluslararasi kaynaklarda uygunluk ulkeye gore degisebilir.

## Kisa Vadeli Oncelikler

1. Parserlari kaynak bazli dosyalara ayir.
2. Detay sayfasi tarama ve PDF dokuman okuma ekle.
3. PostgreSQL ile cagri gecmisi tut.
4. Kullanıcı hesabı gerektirmeyen public paylaşım ve kaynak doğrulama özelliklerini geliştir.
5. Admin ekranindan kaynak durumunu izlet.
