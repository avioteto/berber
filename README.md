# Berber Randevu Sistemi

Berber için online randevu alma websitesi — Node.js + Express.
Randevular ve saat kapatmaları iki modlu depolama katmanında saklanır:

| Mod | Ne zaman | Nerde saklanır | Kesinti olsa |
|---|---|---|---|
| `STORAGE=file` (varsayılan) | localhost / geliştirme | `data/db.json` | Dosya silinmedikçe kalıcı |
| `STORAGE=turso` | canlı deployment | Turso bulut veritabanı | Sunucu yenilense bile kaybolmaz |

İnternete yayına alma adımları için → **[DEPLOY.md](DEPLOY.md)**

## Başlatma (localhost)

```bash
npm install   # sadece ilk sefer
npm start
```

Tarayıcıda: **http://localhost:3000**

Aynı Wi-Fi'dan telefondan: `ipconfig` → "IPv4 Address" bak (örn. `192.168.1.34`) →
telefondan `http://192.168.1.34:3000`.

## Dükkâna göre özelleştirme

Tek yer: `server.js` dosyasının en üstündeki `CONFIG` bloğu.

| Alan | Anlamı |
|---|---|
| `shopName` | Dükkan adı (her yere otomatik yansır) |
| `openHour` / `closeHour` | Çalışma saatleri |
| `slotMinutes` | Randevu aralığı (dk) |
| `closedDays` | Kapalı günler (0=Pazar, 1=Pazartesi, …). `[0, 6]` yaparsanız pazar+cuma kapalı |
| `adminPass` | Berber giriş şifresi (canlıda ortam değişkeni: `ADMIN_PASS`) |
| `barbers` | Personel listesi |
| `services` | Hizmet adı, ikon, fiyat, açıklama |

Adres de `public/index.html` içindeki footer'da ("Örnek Mah. Tıraş Sok. No:1") yazıyor.

## Ekranlar

- **Ana Sayfa** — hizmetler ve fiyatlar
- **Randevu Al** — isim, telefon, hizmet, tarih, personel + müsait saatler (dolular pasif)
- **Randevularım** — telefonla randevu sorgulama ve iptal
- **Berber Girişi** — tüm randevular, gün/gelecek/toplam sayıları, CSV indirme, **Saat/Gün Kapatma**

## Dosya yapısı

```
berber-randevu/
├─ server.js          # sunucu + API + AYARLAR + depolama katmanı
├─ package.json
├─ render.yaml        # Render.com deploy ayarı
├─ DEPLOY.md          # canlıya alma rehberi
├─ data/db.json       # (STORAGE=file iken) veritabanı; otomatik oluşur
└─ public/index.html  # arayüz
```

## API (geliştirmek isteyenler için)

- `GET  /api/health` — sağlık kontrolü (uptime ping için)
- `GET  /api/config` — vitrin bilgileri
- `GET  /api/slots/:date` — o günün dolu/müsait/kapalı saatleri
- `POST /api/appointments` — randevu oluştur
- `GET  /api/appointments?phone=…` — müşterinin randevuları
- `DELETE /api/appointments/:code?phone=…` — müşteri iptali
- `GET  /api/admin/appointments` — tümü (başlık: `x-admin-pass`)
- `DELETE /api/admin/appointments/:code` — admin silme
- `GET/POST/DELETE /api/admin/blocked` — saat/gün kapatma yönetimi
