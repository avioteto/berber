# PROJE ÖZETİ — Değişim Hair Studio Randevu Sitesi

> 📌 **Yeni oturum açıldığında:** "PROJE_OZETI.md dosyasını oku ve projeye devam edelim" demek yeterli.
> Bu dosya son güncelleme: Kasım 2026.

---

## 1. Proje Kimliği

| | |
|---|---|
| 🏪 Dükkân | **Değişim Hair Studio** — Pirler Mah. Adnan Menderes Blv. No:46/C, Merkez/Kütahya |
| 👤 Personel | Mahmut (tek berber) |
| 🕐 Randevu | 45 dk aralık, 09:00–21:00 (son randevu 20:15), **Pazar kapalı** |
| 🌐 Canlı adres | https://berber-randevu-cefg.onrender.com |
| 📞 Telefon | 0544 866 37 24 (footer'da tıklanabilir tel linki) |
| 📷 Instagram | @degisim_hair_studyo (footer'da link) |

## 2. Dosya / Yerel Yapı

| Yol | Ne işe yarar |
|---|---|
| `C:\Users\sevke\OneDrive\Belgeler\GitHub\berber` | **ASIL ÇALIŞMA KLASÖRÜ** — GitHub klonu; değişiklikler buraya yapılır, kullanıcı GitHub Desktop ile Commit+Push eder |
| `C:\Users\sevke\Desktop\opencode\berber-randevu` | Eski draft klasör (ünüda artık kullanMA; sorun çıkarsa referans olarak bak) |
| github.com/avioteto/berber | Deponun kendisi (public, main dalı). Kullanıcı adı: avioteto |

## 3. Teknik Yapı

- **Sunucu:** Node.js + Express — HERŞEY tek `server.js` dosyasında:
  - En üstte **CONFIG bloğu**: shopName, openHour/closeHour, slotMinutes(45), closedDays([0]=Pazar), adminPass fallback, barbers(["Mahmut"]), services listesi (hizmet adı/ikon/fiyat/açıklama)
  - **Depolama katmanı çift mod:**
    - `STORAGE=file` (varsayılan) → yerelel JSON: `data/db.json` (localhost)
    - `STORAGE=turso` → Turso bulut DB (@libsql/client paketi; Render env: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, değerler Render panelde, repoda ASLA yok)
  - Turso şeması: appointments, blocked, settings tabloları
- **Arayüz:** tek dosya `public/index.html` (vitrin + randevu formu + randevularım + admin panel, hepsi tab sistemiyle)
- **Deploy:** render.yaml (Blueprint) → node, npm install / npm start, Free plan, health check `/api/health`
- **Uptime:** cron-job.org "berber ping" job'ı her 10 dk'da `/api/health`'e vurur (ücretsiz Render uykusunu engeller)

## 4. API Özeti

Ortak: `GET /api/health`, `GET /api/config`, `GET /api/slots/:date`, `POST /api/appointments`, `GET /api/appointments?phone=`, `DELETE /api/appointments/:code?phone`
Admin (`x-admin-pass` başlığıyla): `GET/DELETE /api/admin/appointments`, `GET/POST/DELETE /api/admin/blocked`, `POST /api/admin/settings/password` (panelden şifre değişimi), `POST /api/admin/settings/password-reset` (Render ADMIN_PASS as sıfırlama anahtarı)

## 5. Güvenlik / Admin Şifresi Mekaniği

- Aktif şifre: önce veritabanındaki hash'li `settings.admin_pass`; yoksa Render env `ADMIN_PASS` (başka fallback yok)
- Şifre panel üzerinde **scrypt hash'iyle** saklanır, düz metin asla yazılmaz
- **5 hatalı deneme → IP 10 dk kilit** (bellek içi failLog; 429 + "kalan süre" döner)
- Panelden şifre değişince env şifre devre dışı kalır (sadece sıfırlama anahtarı kalır)
- Kullanıcı şifresini bilmez; Render panelinden bakabilir/değiştirebilir

## 6. Kullanıcının İş Akışı (her değişiklikte)

1. Sen (asistant) klon klasördeki dosyaları düzenle
2. Kullanıcı: GitHub Desktop → `berber` → **Summary** kutusuna kısa açıklama → **Commit to main** → **Push origin**
3. Render otomatik deploy (~1-2 dk), canlıya yansır
4. Canlı kontrol: `https://berber-randevu-cefg.onrender.com/api/health` ve ilgili endpointler

GitHub Desktop'ta sorun çıkarsa ekran görüntüsü istenmeli (aynı deponu обновi varsa çakışma uyarısı vs.)

## 7. Test Geçmişi (kapsamlı, lokalde + canlıda)

- Çakışma engeli (409), kapatılan saat engeli (400), geçmiş tarih (400), yanlış telefon iptali (403), admin 401/429, hash'li şifre değişim→geri alma döngüsü — TÜMÜ ✅
- Canlı Turso mod: randevu oluştur/çakaş/iptal + blocked CRUD ✅
- Test verisi kullanıcıya ait tek "emre sevindik" kaydı dışında temizlendi

## 8. Açık / Önerilen Maddeler (isteğe bağlı sıradaki işler)

- ⏳ Hizmet/fiyat listesi hâlâ örnek liste (Saç Kesimi 400₺ vs.) — kullanıcıdan gerçek liste alınmalı
- 💡 QR kod üretme/ekleme fikri (diğer VT: site linkini QR yapıştırma)
- 💡 WhatsApp randevu linki (wa.me/905448663724?text=...) önerisi yapıldı, henüz eklenmedi
- 💡 "Aynı telefonla max 2 aktif randevu" spam sınırı önerildi, henüz eklenmedi
- Turso panelindeki "Block Reads/Writes" anahtarları KAPALI kalmalı (kullanıcıya hatırlatıldı)

## 9. Önemli Değişkenler / Hesaplar (sahiplik kullanıcıda)

| Servis | Hesap | Ne var orada |
|---|---|---|
| GitHub | avioteto | repo: berber |
| Render | avioteto (GitHub login) | Web Service: berber-randevu; env: STORAGE=turso, ADMIN_PASS, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN |
| Turso | GitHub login | DB: `berber` (libsql://berber-avioteto.aws-eu-central-1.turso.io) |
| cron-job.org | kullanıcı üyeliği | Job: "berber ping" (10 dk /health) |

> ⚠️ Not: asistanın hiçbir şifre/token'i BİLMESİ gerekmez ve bilmeden çalışır; panelden bilinmeli.

## 10. Yeni Oturum Başlatma Şablonu

> "PROJE_OZETI.md dosyasını oku ve projeye devam edelim. Şu değişikliği istiyorum: **________**"

(İstek yazıldığında asistanın bakacağı ilk yerler: `server.js` CONFIG bloğu ve `public/index.html`.)
