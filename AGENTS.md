# HibeRota Codex Calisma Kurallari

## Git ve worktree

- main branch uzerinde dogrudan degisiklik yapma.
- Her buyuk gelistirmeyi ayri feature branch ve worktree uzerinde yap.
- Kullanicinin commit edilmemis degisikliklerini silme.
- Force push, hard reset ve git clean kullanma.
- Calismayi temiz bir Git durumu ile tamamla.

## Mimari

- Web uygulamasi scraper calistirmamalidir.
- Scraper ve queue islemleri automation katmaninda bulunmalidir.
- Web uygulamasi cagrilari repository katmanindan okumalidir.
- Web uygulamasi ve worker ortak veri sozlesmelerini kullanmalidir.
- Mevcut API sozlesmelerini bozma.

## Otomasyon

- Her kaynak scraper strategy sozlesmesine uymalidir.
- Kaynak bazli buyuk if/else zinciri olusturma.
- Bir scraper hatasi diger kaynaklari durdurmamalidir.
- Dogrulanmamis kaynaklari healthy olarak isaretleme.
- Duplicate cagrilari tekillestir.
- Kapanan cagrilari silme.
- Retry, backoff ve DLQ davranislarini koru.

## Kalite

- Degisiklikler icin test ekle veya mevcut testleri guncelle.
- npm run lint calistir.
- npm test calistir.
- npm run build calistir.
- Basarisiz kontrolleri gizleme.
- Placeholder veya TODO birakip isi tamamlanmis gosterme.

## Guvenlik

- Secret veya token commit etme.
- CAPTCHA veya erisim kontrollerini asma.
- SSRF ve domain allowlist kontrollerini koru.
- Resmi olmayan kaynaklari canonical kaynak yapma.
