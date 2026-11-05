/* =========================================================
   Berber Ahmet — Online Randevu Sunucusu (Express)
   -------------------------------------------------------
   Depolama iki modda çalışır:
     STORAGE=file  → yerel JSON dosyası (data/db.json)   [varsayılan]
     STORAGE=turso → Turso bulut veritabanı (kalıcı, canlı deployment)

   Turso için gereken ortam değişkenleri:
     TURSO_DATABASE_URL = https://<db>.turso.io gibi URL
     TURSO_AUTH_TOKEN   = Turso panelinden alınan token

   Canlı dağıtımda ayrıca önerilir:
     ADMIN_PASS         = güçlü berber paneli şifresi

   Başlatmak için:  npm start     (veya: node server.js)
   ========================================================= */

const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================== AYARLAR — dükkanınıza göre değiştirin ================== */
const CONFIG = {
  shopName: "Değişim Hair Studio",
  openHour: 9,        // 09:00
  closeHour: 21,      // 21:00 (son randevu 20:30)
  slotMinutes: 45,
  closedDays: [0],    // 0 = Pazar kapalı — birden fazla: [0, 6]
  adminPass: process.env.ADMIN_PASS || "admin123",
  barbers: ["Mahmut"],
  services: [
    { name: "Saç Kesimi",             icon: "✂",  price: 400, desc: "Makas ve makine ile dilediğiniz modelde saç kesimi; fade, pompadour ve trend kesimler dahil." },
    { name: "Sakal Tıraşı",           icon: "🧔", price: 250, desc: "Jilet veya makine ile sakal şekillendirme, keskin hat ve bitiş bakımı." },
    { name: "Saç + Sakal Kombi",      icon: "✨", price: 550, desc: "Saç kesimi ve sakal tıraşı birlikte; ustura ile hatlar, losyon ile bitiş." },
    { name: "Kulak Ateşleme",         icon: "🔥", price: 150, desc: "Geleneksel kulak ve burun tüyü temizliği (ateşleme yöntemi)." },
    { name: "Yıkama & Şekillendirme", icon: "🚿", price: 100, desc: "Şampuanla yıkama, fön ve pomada ile şekillendirme." },
  ],
};
/* =========================================================================== */

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE  = path.join(DATA_DIR, "db.json");
const STORAGE_MODE = (process.env.STORAGE || "file").toLowerCase();

/* ---------- Yardımcılar (tur modundan bağımsız) ---------- */
const phoneDigits = p => String(p || "").replace(/\D/g, "");
const toLocalISO = d =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

function slotList() {
  const out = [];
  for (let h = CONFIG.openHour; h < CONFIG.closeHour; h++)
    for (let m = 0; m < 60; m += CONFIG.slotMinutes)
      out.push(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
  return out;
}

function isValidSlotDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  return toLocalISO(d) === dateStr; // gerçek bir takvim günü mü
}

/* ============ DEPOLAMA KATMANI (arayüz bütünüyle aynı) ============
   Tüm fonksiyonlar async:
   listAppointments(), insertAppointment(a), deleteAppointmentByCode(code)
   listBlocked(), insertBlocked(date, time), deleteBlocked(date, time)
================================================================== */

/* --- 1) Yerel JSON dosya deposu (StorAGED file) --- */
function createFileStore() {
  let db = { appointments: [], blocked: [] };

  function init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        db.appointments = Array.isArray(parsed.appointments) ? parsed.appointments : [];
        db.blocked      = Array.isArray(parsed.blocked)      ? parsed.blocked      : [];
      }
    } catch (e) {
      console.error("DB okunamadı, sıfırlanıyor:", e.message);
      db = { appointments: [], blocked: [] };
    }
  }

  async function persist() {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    await fsp.writeFile(tmp, JSON.stringify(db, null, 2), "utf8"); // atomik yazma
    await fsp.rename(tmp, DB_FILE);
  }

  return {
    init,
    async listAppointments()          { return db.appointments; },
    async insertAppointment(appt)     { db.appointments.push(appt); await persist(); },
    async deleteAppointmentByCode(code) {
      const before = db.appointments.length;
      db.appointments = db.appointments.filter(a => a.code !== code);
      if (db.appointments.length === before) return false;
      await persist(); return true;
    },
    async listBlocked()               { return db.blocked; },
    async insertBlocked(date, time)   {
      if (db.blocked.some(b => b.date === date && b.time === time)) return;
      db.blocked.push({ date, time }); await persist();
    },
    async deleteBlocked(date, time) {
      const before = db.blocked.length;
      db.blocked = db.blocked.filter(b => !(b.date === date && b.time === time));
      if (db.blocked.length === before) return false;
      await persist(); return true;
    },
  };
}

/* --- 2) Turso bulut deposu (STORAGE=turso) --- */
async function createTursoStore() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("STORAGE=turso için TURSO_DATABASE_URL ortam değişkeni gerekli.");
  const { createClient } = require("@libsql/client");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS appointments (
      code    TEXT PRIMARY KEY,
      name    TEXT NOT NULL,
      phone   TEXT NOT NULL,
      service TEXT,
      date    TEXT NOT NULL,
      time    TEXT NOT NULL,
      barber  TEXT,
      created INTEGER
    );
    CREATE TABLE IF NOT EXISTS blocked (
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      PRIMARY KEY (date, time)
    );
  `);

  return {
    async listAppointments() {
      const rs = await client.execute("SELECT code, name, phone, service, date, time, barber, created FROM appointments");
      return rs.rows.map(r => ({
        code: r.code, name: r.name, phone: r.phone, service: r.service,
        date: r.date, time: r.time, barber: r.barber, created: r.created,
      }));
    },
    async insertAppointment(a) {
      await client.execute({
        sql: `INSERT INTO appointments (code, name, phone, service, date, time, barber, created)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [a.code, a.name, a.phone, a.service, a.date, a.time, a.barber, a.created],
      });
    },
    async deleteAppointmentByCode(code) {
      const rs = await client.execute({ sql: "DELETE FROM appointments WHERE code = ?", args: [code] });
      return rs.rowsAffected > 0;
    },
    async listBlocked() {
      const rs = await client.execute("SELECT date, time FROM blocked");
      return rs.rows.map(r => ({ date: r.date, time: r.time }));
    },
    async insertBlocked(date, time) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO blocked (date, time) VALUES (?, ?)",
        args: [date, time],
      });
    },
    async deleteBlocked(date, time) {
      const rs = await client.execute({
        sql: "DELETE FROM blocked WHERE date = ? AND time = ?",
        args: [date, time],
      });
      return rs.rowsAffected > 0;
    },
    client, // yönetim/yardımcı işlemler için
  };
}

let storage; // seçilen depo

async function initStorage() {
  if (STORAGE_MODE === "turso") {
    storage = await createTursoStore();
    console.log("🗄  Depolama: Turso bulut veritabanı");
  } else {
    storage = createFileStore();
    storage.init();
    console.log("🗄  Depolama: yerel JSON dosyası (data/db.json)");
  }
}

/* ---------- Middleware ---------- */
app.use(express.json());

/* ---------- Statik site ---------- */
app.use(express.static(path.join(__dirname, "public")));

/* ================== ORTAK API ================== */

/* Sağlık kontrolü (uptime ping'leri için) */
app.get("/api/health", (req, res) => res.json({ ok: true, storage: STORAGE_MODE }));

/* Vitrin: dükkan adı, hizmetler, saatler — sadece buradan değiştirilir */
app.get("/api/config", (req, res) => {
  const { adminPass, ...pub } = CONFIG; // şifreyi asla gönderme
  res.json(pub);
});

/* Bugünkü randevu sayısı (header rozeti için) */
app.get("/api/today-count", async (req, res) => {
  try {
    const today = toLocalISO(new Date());
    const appts = await storage.listAppointments();
    res.json({ count: appts.filter(a => a.date === today).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Saat durumu: dolu / geçmiş / berber kapattı */
app.get("/api/slots/:date", async (req, res) => {
  try {
    const date = req.params.date;
    if (!isValidSlotDate(date)) return res.status(400).json({ error: "Geçersiz tarih." });

    const day = new Date(date + "T00:00:00").getDay();
    if (CONFIG.closedDays.includes(day)) return res.json({ closed: true, reason: "fixed", slots: [] });

    const blockedRows = await storage.listBlocked();
    const appts = await storage.listAppointments();

    if (blockedRows.some(b => b.date === date && b.time === "*"))
      return res.json({ closed: true, reason: "admin", slots: [] });

    const takenSet   = new Set(appts.filter(a => a.date === date).map(a => a.time));
    const blockedSet = new Set(blockedRows.filter(b => b.date === date).map(b => b.time));

    const now = new Date();
    const today = toLocalISO(now);
    const slots = slotList().map(t => {
      const [h, m] = t.split(":").map(Number);
      const past = date === today && (h * 60 + m) <= now.getHours() * 60 + now.getMinutes() + 30;
      return { time: t, taken: takenSet.has(t), past, blocked: blockedSet.has(t) };
    });
    res.json({ closed: false, slots });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Randevu oluştur */
app.post("/api/appointments", async (req, res) => {
  try {
    const { name, phone, service, date, time, barber } = req.body || {};

    if (!name || String(name).trim().length < 2 || String(name).length > 50)
      return res.status(400).json({ error: "Geçerli bir isim girin." });
    if (phoneDigits(phone).length < 10)
      return res.status(400).json({ error: "Geçerli bir telefon numarası girin." });
    if (!CONFIG.services.some(s => s.name === service))
      return res.status(400).json({ error: "Geçersiz hizmet." });
    if (!isValidSlotDate(date))
      return res.status(400).json({ error: "Geçersiz tarih." });

    const day = new Date(date + "T00:00:00").getDay();
    if (CONFIG.closedDays.includes(day))
      return res.status(400).json({ error: "Bu gün kapalıyız, lütfen başka bir gün seçin." });
    if (date < toLocalISO(new Date()))
      return res.status(400).json({ error: "Geçmiş tarih seçilemez." });
    if (!slotList().includes(time))
      return res.status(400).json({ error: "Geçersiz saat." });

    const now = new Date();
    const today = toLocalISO(now);
    const [h, m] = time.split(":").map(Number);
    if (date === today && (h * 60 + m) <= now.getHours() * 60 + now.getMinutes() + 30)
      return res.status(400).json({ error: "Bu saat geçmiş. Lütfen başka bir saat seçin." });

    const appts = await storage.listAppointments();
    const blockedRows = await storage.listBlocked();

    if (blockedRows.some(b => b.date === date && b.time === "*"))
      return res.status(400).json({ error: "Berber bu günü kapatmış. Lütfen başka bir gün seçin." });
    if (blockedRows.some(b => b.date === date && b.time === time))
      return res.status(400).json({ error: "Berber bu saati kapattı. Lütfen başka bir saat seçin." });
    if (appts.some(a => a.date === date && a.time === time))
      return res.status(409).json({ error: "Bu saat az önce alındı. Başka bir saat seçin.", conflict: true });

    let code;
    do { code = "BR-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
    while (appts.some(a => a.code === code));

    const appt = {
      code,
      name: String(name).trim(),
      phone: String(phone).trim(),
      service,
      date,
      time,
      barber: CONFIG.barbers.includes(barber) ? barber : CONFIG.barbers[0],
      created: Date.now(),
    };
    await storage.insertAppointment(appt);
    res.status(201).json(appt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Müşterinin kendi randevuları (telefonla) */
app.get("/api/appointments", async (req, res) => {
  try {
    const ph = phoneDigits(req.query.phone);
    if (ph.length < 10) return res.status(400).json({ error: "Geçerli bir telefon numarası girin." });
    const appts = await storage.listAppointments();
    const list = appts
      .filter(a => phoneDigits(a.phone) === ph)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Müşteri iptali (telefon eşleşmesi şart) */
app.delete("/api/appointments/:code", async (req, res) => {
  try {
    const appts = await storage.listAppointments();
    const appt = appts.find(a => a.code === req.params.code);
    if (!appt) return res.status(404).json({ error: "Randevu bulunamadı." });
    if (phoneDigits(req.query.phone) !== phoneDigits(appt.phone))
      return res.status(403).json({ error: "Bu randevuyu yalnızca randevu sahibi iptal edebilir." });

    await storage.deleteAppointmentByCode(appt.code);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================== ADMİN API ================== */

function adminAuth(req, res, next) {
  if (req.get("x-admin-pass") !== CONFIG.adminPass)
    return res.status(401).json({ error: "Yetkisiz. Şifre hatalı." });
  next();
}

app.get("/api/admin/appointments", adminAuth, async (req, res) => {
  try {
    const list = await storage.listAppointments();
    res.json(list.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/appointments/:code", adminAuth, async (req, res) => {
  try {
    const ok = await storage.deleteAppointmentByCode(req.params.code);
    if (!ok) return res.status(404).json({ error: "Randevu bulunamadı." });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Berber: saat / gün kapatma yönetimi */
app.get("/api/admin/blocked", adminAuth, async (req, res) => {
  try {
    const date = req.query.date;
    if (!isValidSlotDate(date)) return res.status(400).json({ error: "Geçersiz tarih." });
    const blockedRows = await storage.listBlocked();
    res.json({
      dayBlocked: blockedRows.some(b => b.date === date && b.time === "*"),
      blocked: blockedRows.filter(b => b.date === date && b.time !== "*").map(b => b.time),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/blocked", adminAuth, async (req, res) => {
  try {
    const { date, time } = req.body || {};
    if (!isValidSlotDate(date)) return res.status(400).json({ error: "Geçersiz tarih." });
    if (time !== "*" && !slotList().includes(time))
      return res.status(400).json({ error: "Geçersiz saat." });
    await storage.insertBlocked(date, time);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/blocked", adminAuth, async (req, res) => {
  try {
    const { date, time } = req.query;
    if (!isValidSlotDate(date)) return res.status(400).json({ error: "Geçersiz tarih." });
    if (time !== "*" && !slotList().includes(time))
      return res.status(400).json({ error: "Geçersiz saat." });
    await storage.deleteBlocked(date, time);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ---------- Server başlat ---------- */
initStorage()
  .then(() => app.listen(PORT, () => {
    console.log(`✂ ${CONFIG.shopName} randevu sunucusu çalışıyor:  http://localhost:${PORT}`);
  }))
  .catch(e => {
    console.error("Depolama başlatılamadı:", e.message);
    process.exit(1);
  });
