# Hibe Rota VPS Canliya Alma Rehberi

Bu rehber, ekranda secilen TR-VPS-4 sinifi sunucu icin hazirlandi: 2 CPU, 4 GB RAM, 60 GB SSD, AlmaLinux 8.

## Hedef Mimari

- AlmaLinux 8 VPS
- Docker Compose ile `app` + `redis`
- SQLite verisi Docker volume icinde kalici: `/app/.hiberota/database.sqlite`
- Nginx reverse proxy: domain -> `127.0.0.1:5173`
- Certbot ile HTTPS
- Worker profili ilk yayinda kapali; uygulama gelistikce ayrica acilabilir

## Sunucu Kurulumu

```bash
sudo dnf update -y
sudo dnf install -y git nginx firewalld certbot python3-certbot-nginx
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker nginx firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Uygulamayi Hazirlama

```bash
sudo mkdir -p /opt/hiberota
sudo chown "$USER":"$USER" /opt/hiberota
git clone <repo-url> /opt/hiberota
cd /opt/hiberota
cp .env.example .env
openssl rand -hex 32
```

`.env` icinde en az su alanlari gercek degerlerle guncelle:

```bash
PUBLIC_BASE_URL=https://hiberota.com
SOURCE_USER_AGENT=Hiberota/1.0 (+https://hiberota.com; contact: info@hiberota.com)
ADMIN_API_TOKEN=<openssl-ciktisi>
```

## Ilk Deploy

```bash
npm ci
npm run production:preflight
docker compose -f deploy/docker-compose.prod.yml up -d --build app redis
docker compose -f deploy/docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:5173/healthz
```

## Nginx ve SSL

```bash
sudo cp deploy/nginx/hiberota.conf /etc/nginx/conf.d/hiberota.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d hiberota.com -d www.hiberota.com
```

SSL sonrasinda kontrol:

```bash
curl -fsS https://hiberota.com/healthz
curl -fsS https://hiberota.com/api/v1/automation/metrics
```

## Sonraki Gelistirmelerde Deploy

```bash
cd /opt/hiberota
git pull
npm ci
npm run production:preflight
docker compose -f deploy/docker-compose.prod.yml up -d --build app redis
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 app
curl -fsS http://127.0.0.1:5173/healthz
```

## Backup

Veri SQLite volume icinde tutulur. Haftalik degil, gunluk backup onerilir:

```bash
docker compose -f deploy/docker-compose.prod.yml exec app npm run db:backup
docker compose -f deploy/docker-compose.prod.yml exec app ls -lh /app/.hiberota/backups
```

Sunucu disina kopyalama icin ayrica bir object storage veya baska bir makineye `rsync` planlanmalidir.

## VPS Limit Notlari

- 4 GB RAM icin `worker` profili ilk canli yayinda acilmadi.
- Redis 256 MB maxmemory ile sinirlandi.
- App container `NODE_OPTIONS=--max-old-space-size=768` ile baslatilir.
- Docker loglari rotate edilir; 60 GB diskte logsuz kalma riski azaltildi.
- App sadece localhost portuna baglanir; dis dunyaya Nginx ve HTTPS acilir.
