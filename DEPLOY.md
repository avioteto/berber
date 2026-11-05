# 🚀 Canlıya Alma Rehberi (Ücretsiz + Kalıcı)

Amaç: siteyi internetten herkesin erişebileceği kalıcı bir adresle yayına almak.
Stack: **Render.com** (sunucu, bedava) + **Turso** (veritabanı, bedava) → aylık maliyet **$0**, veri **kalıcı**.

---

## Adım 1 — Turso veritabanı oluştur (~5 dk)

1. **https://turso.tech** → "Get Started" → GitHub hesabınla giriş yap (ücretsiz).
2. Dashboard'da **"Create Database"**:
   - Name: `berber`
   - Location: İstanbul'a en yakın bölge (örn. `fra`)
   - Boyut: varsayılan bırak
3. Oluşan kartta **"Connect"** bölümünden şunu kopyala:
   - **Database URL** → şöyle görünür: `libsql://berber-xxxx.turso.io`
4. Aynı ekranda **"Create Token"** → uzun bir token üretir, onu da kopyala.

> Bu iki değeri yedekle ama kimseyle paylaşma. Kod repolarına yazmıyoruz —
> sadece Render paneline gireceğiz (aşağıda).

## Adım 2 — GitHub'a kodu yükle (~10 dk)

> **Not:** Bilgisayarında git komutu kurulu değil — gerek de yok.
> **GitHub Desktop** kendi git'ini içerir ve deposu tek tıkla kurar; Yol A'yı kullan.

**Yol A — GitHub Desktop (önerilen):**
1. **https://github.com** → üye ol / giriş yap.
2. **https://desktop.github.com** → GitHub Desktop indir, kur, giriş yap.
3. `File → Add local repository…` → `berber-randevu` klasörünü seç → uygulama "Not yet a repository" der ve **"Create a repository here" / "Initialize"** seçeneği sunar → onayla (`.gitignore` zaten klasörde, `node_modules` ve `data/` yüklenmez).
4. Menüden `Repository → Publish repository` → adı `berber-randevu` bırak → **Publish**'e bas.

**Yol B — Komut satırı (isteğe bağlı, git for windows gerektirir):**
```bash
cd berber-randevu
git remote add origin https://github.com/KULLANICI_ADIN/berber-randevu.git
git push -u origin main
```
(GitHub, terminalden şifre istemeyebilir; bunun yerine "Personal Access Token" gerekiyor → GitHub → Settings → Developer settings → Token üret.)

## Adım 3 — Render'a kurulum (~5 dk)

1. **https://render.com** → "Sign in with GitHub" (bedava).
2. Dashboard'da **New + → Web Service**.
3. GitHub reponu seç: `berber-randevu` → "Connect".
4. Ayarlar (repo'daki `render.yaml` bunları içeriyor; elle girme gerekirse):
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
5. **Advanced → Add Environment Variable** (hepsi Adım 1'den):
   | Key | Value |
   |---|---|
   | `STORAGE` | `turso` |
   | `ADMIN_PASS` | güçlü bir şifre (örn. 16+ karakter) |
   | `TURSO_DATABASE_URL` | Adım 1'deki Database URL |
   | `TURSO_AUTH_TOKEN` | Adım 1'deki Token |
6. **Create Web Service** → 1-2 dk içinde "Live" olur.
7. Deploy Log'da `✂ Berber … çalışıyor` ve `🗄 Depolama: Turso bulut veritabanı` görülmeli.

Bu adımdan sonra siten internete açılmıştır: `https://berber-randevu.onrender.com` gibi bir adres alır (Render adres sonuna küçük bir ek verir). Linki müşterilerle paylaşabilir, Instagram bio'ya koyabilirsin 🎉

## Adım 4 — Uykuya dalmayı engelle (opsiyonel ama önerilir)

Bedava Render sunucusu 15 dk istek gelmezse kapanır; sonraki ziyaretçi 20-40 sn bekler. Bunu önle:

1. **https://cron-job.org** → ücretsiz üyelik.
2. **Cronjobs → Create cronjob**:
   - URL: `https://SİTE-ADRESİ.onrender.com/api/health`
   - Schedule: **her 10 dakika**
3. Kaydet. Bitti.

## Adım 5 — (Opsiyonel) Kendi alan adın

1. isimtescil / natro / Namecheap'ten alan adı al (örn. `berberahmet.com`, ~300₺/yıl).
2. Render paneli: Settings → **Custom Domains** → alan adını ekle → sana bir **CNAME** değeri verir.
3. Alan adı firmanın DNS paneline o CNAME'i gir → Render HTTPS'i otomatik sağlar.

---

## Son Kontrol Listesi

- [ ] `.gitignore` var, repo temiz (evet — default hazır)
- [ ] Turso URL + token **Render'da** girildi; repoda yazınız yok
- [ ] `ADMIN_PASS` güçlü bir şifre
- [ ] `/api/health` terminalde 200 dönüyor
- [ ] Telefondan test ettin (mobil uyumlu)
- [ ] Berber panelinden test günü kapatma çalışıyor mu?

## Sorun Giderme

| Belirti | Çözüm |
|---|---|
| Deploy hatası: "STORAGE=turso için TURSO_DATABASE_URL gerekli" | Env var eksik/hatalı → Render → Environment bölümünü kontrol |
| Müşteriden veriler kayboldu | Canlıda `STORAGE` ortam değişkeni `turso` değil → render.yaml'da default olarak `turso` var; elle girilmemişse gözden geçir |
| `401` berber paneline girişte | Paneldaki şifre `ADMIN_PASS` ortam değişkeniyle eşleşmiyor |
| İlk açılış 20-40 saniye | Bedava planın uyku davranışı → Adım 4'teki cron'u ekle |
| 403: "Bu randevuyu yalnızca randevu sahibi" | Yanlış telefonla iptal etmeye çalışıyorsun → normal davranış |
