require("dotenv").config();

const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "public", "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!process.env.SESSION_SECRET) {
  console.error("Missing SESSION_SECRET. Copy .env.example to .env and set a long secret.");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "ChangeThisPassword123!") {
  console.error("Set a private ADMIN_PASSWORD in .env before starting the website.");
  process.exit(1);
}

const db = new Database(path.join(DATA_DIR, "fabworks.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const initialAdmin = db.prepare("SELECT id FROM admins WHERE username = ?").get(process.env.ADMIN_USERNAME || "admin");
if (!initialAdmin) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(process.env.ADMIN_USERNAME || "admin", hash);
}

const serviceCount = db.prepare("SELECT COUNT(*) AS n FROM services").get().n;
if (serviceCount === 0) {
  const insert = db.prepare("INSERT INTO services (title, description) VALUES (?, ?)");
  insert.run("Metal Fabrication", "Custom metal fabrication with strong construction and clean finishing.");
  insert.run("Welding Work", "Reliable welding solutions for different types of metal structures.");
  insert.run("Gate & Grill", "Custom gates, grills and metal safety structures.");
}

const defaultSettings = {
  businessName: "AS FABRICATOR",
  tagline: "Professional Fabrication & Welding Services",
  phone: "",
  whatsapp: "",
  address: "",
  email: "",
  about: "We are a fabrication and welding business committed to quality workmanship, strong construction and customer satisfaction. With more than 10 years of experience and over 5 years in business, we focus on reliable metal fabrication and welding solutions.",
  yearsBusiness: "5+",
  yearsExperience: "10+"
};
const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [key, value] of Object.entries(defaultSettings)) insertSetting.run(key, value);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(ROOT, "public")));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG and WEBP images are allowed."));
    }
    cb(null, true);
  }
});

const enquiryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const reviewLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: "Please login first." });
  next();
}

function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}

async function sendWhatsAppNotification(enquiry) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ownerNumber = process.env.WHATSAPP_OWNER_NUMBER;
  if (!token || !phoneId || !ownerNumber) {
    return { sent: false, reason: "WhatsApp API is not configured." };
  }

  const version = process.env.WHATSAPP_API_VERSION || "v22.0";
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: ownerNumber,
    type: "text",
    text: {
      preview_url: false,
      body: `New website enquiry\\nName: ${enquiry.customer_name}\\nMobile: ${enquiry.mobile}\\nService: ${enquiry.service}\\nMessage: ${enquiry.message}`
    }
  };

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("WhatsApp API error:", result);
    return { sent: false, reason: "WhatsApp provider rejected the message." };
  }
  return { sent: true };
}

// Public API
app.get("/api/public", (req, res) => {
  const settings = getSettings();
  const services = db.prepare("SELECT id, title, description FROM services WHERE active = 1 ORDER BY id DESC").all();
  const reviews = db.prepare("SELECT id, customer_name, rating, message, created_at FROM reviews WHERE status = 'approved' ORDER BY id DESC LIMIT 12").all();
  const gallery = fs.readdirSync(UPLOAD_DIR)
    .filter(name => /\.(jpg|jpeg|png|webp)$/i.test(name))
    .map(name => ({ url: `/uploads/${name}`, name }));
  res.json({ settings, services, reviews, gallery });
});

app.post("/api/enquiries", enquiryLimiter, async (req, res) => {
  const { name, mobile, service, message, website } = req.body || {};
  // Honeypot field: bots often fill hidden website field.
  if (website) return res.json({ ok: true });
  if (!name || !mobile || !service || !message) {
    return res.status(400).json({ error: "Please complete all enquiry fields." });
  }
  if (String(name).length > 100 || String(mobile).length > 25 || String(message).length > 1500) {
    return res.status(400).json({ error: "One or more fields are too long." });
  }

  const enquiry = {
    customer_name: String(name).trim(),
    mobile: String(mobile).trim(),
    service: String(service).trim(),
    message: String(message).trim()
  };
  const result = db.prepare(
    "INSERT INTO enquiries (customer_name, mobile, service, message) VALUES (?, ?, ?, ?)"
  ).run(enquiry.customer_name, enquiry.mobile, enquiry.service, enquiry.message);

  let whatsapp = { sent: false };
  try {
    whatsapp = await sendWhatsAppNotification(enquiry);
  } catch (error) {
    console.error("WhatsApp notification failed:", error.message);
  }

  res.json({ ok: true, id: result.lastInsertRowid, whatsappSent: whatsapp.sent });
});

app.post("/api/reviews", reviewLimiter, (req, res) => {
  const { name, rating, message } = req.body || {};
  const score = Number(rating);
  if (!name || !message || !Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: "Enter your name, a 1–5 star rating and a review." });
  }
  if (String(name).length > 80 || String(message).length > 1000) {
    return res.status(400).json({ error: "Review is too long." });
  }
  db.prepare("INSERT INTO reviews (customer_name, rating, message, status) VALUES (?, ?, ?, 'pending')")
    .run(String(name).trim(), score, String(message).trim());
  res.json({ ok: true, message: "Thank you. Your review has been sent for approval." });
});

// Admin authentication
app.post("/api/admin/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), (req, res) => {
  const { username, password } = req.body || {};
  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(String(username || ""));
  if (!admin || !bcrypt.compareSync(String(password || ""), admin.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  res.json({ ok: true, username: admin.username });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ ok: true, username: req.session.adminUsername });
});

app.get("/api/admin/data", requireAdmin, (req, res) => {
  res.json({
    enquiries: db.prepare("SELECT * FROM enquiries ORDER BY id DESC").all(),
    reviews: db.prepare("SELECT * FROM reviews ORDER BY id DESC").all(),
    services: db.prepare("SELECT * FROM services ORDER BY id DESC").all(),
    settings: getSettings(),
    gallery: fs.readdirSync(UPLOAD_DIR).filter(name => /\.(jpg|jpeg|png|webp)$/i.test(name)).map(name => ({ name, url: `/uploads/${name}` }))
  });
});

app.patch("/api/admin/reviews/:id", requireAdmin, (req, res) => {
  const status = req.body.status;
  if (!["approved", "rejected", "pending"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  const result = db.prepare("UPDATE reviews SET status = ? WHERE id = ?").run(status, Number(req.params.id));
  res.json({ ok: result.changes > 0 });
});

app.post("/api/admin/services", requireAdmin, (req, res) => {
  const { title, description } = req.body || {};
  if (!title || !description) return res.status(400).json({ error: "Title and description are required." });
  db.prepare("INSERT INTO services (title, description) VALUES (?, ?)").run(String(title).trim(), String(description).trim());
  res.json({ ok: true });
});

app.put("/api/admin/services/:id", requireAdmin, (req, res) => {
  const { title, description } = req.body || {};
  if (!title || !description) return res.status(400).json({ error: "Title and description are required." });
  const result = db.prepare("UPDATE services SET title = ?, description = ? WHERE id = ?")
    .run(String(title).trim(), String(description).trim(), Number(req.params.id));
  res.json({ ok: result.changes > 0 });
});

app.delete("/api/admin/services/:id", requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM services WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: result.changes > 0 });
});

app.post("/api/admin/gallery", requireAdmin, upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an image first." });
  res.json({ ok: true, url: `/uploads/${req.file.filename}` });
});

app.delete("/api/admin/gallery/:name", requireAdmin, (req, res) => {
  const name = path.basename(req.params.name);
  const file = path.join(UPLOAD_DIR, name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const allowed = ["businessName", "tagline", "phone", "whatsapp", "address", "email", "about", "yearsBusiness", "yearsExperience"];
  const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const key of allowed) {
    if (req.body[key] !== undefined) stmt.run(key, String(req.body[key]).slice(0, 2000));
  }
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`FABWORKS website running at http://localhost:${PORT}`);
});
