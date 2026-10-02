require("dotenv").config();
const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DATABASE_PATH || "./footballlive.db";
fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });
const db = new Database(DB_PATH);
const API = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY || "";

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
const apiLimiter = rateLimit({ windowMs: 60*1000, limit: 120, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL,
  fixture_id INTEGER NOT NULL,
  PRIMARY KEY(user_id, fixture_id)
);
CREATE TABLE IF NOT EXISTS ad_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  html TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
`);

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const existing = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if (!existing) {
    db.prepare("INSERT INTO users(email,password_hash,role) VALUES(?,?,?)")
      .run(adminEmail, bcrypt.hashSync(adminPassword, 12), "admin");
  }
}

const cache = new Map();
const TTL = Number(process.env.CACHE_TTL_MS || 60000);
const LIVE_TTL = Number(process.env.LIVE_CACHE_TTL_MS || 15000);

async function api(endpoint, params={}) {
  if (!KEY) return { response: [], errors: { message: "API_FOOTBALL_KEY belum diisi" } };
  const qs = new URLSearchParams(params).toString();
  const url = `${API}${endpoint}${qs ? "?" + qs : ""}`;
  const isLive = endpoint.includes("/fixtures") && params.live;
  const ttl = isLive ? LIVE_TTL : (endpoint.includes("/standings") || endpoint.includes("/players/topscorers") ? 3600000 : TTL);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < ttl) return hit.data;
  const res = await fetch(url, { headers: { "x-apisports-key": KEY } });
  if (!res.ok) throw new Error(`API upstream ${res.status}`);
  const data = await res.json();
  cache.set(url, {time: Date.now(), data});
  return data;
}

function requireAuth(req,res,next) {
  if (!req.session.user) return res.status(401).json({error:"Login diperlukan untuk fitur ini."});
  next();
}
function requireAdmin(req,res,next) {
  if (!req.session.user || req.session.user.role !== "admin") return res.status(403).json({error:"Akses admin ditolak."});
  next();
}

const authLimiter = rateLimit({ windowMs: 15*60*1000, limit: 30, standardHeaders: true, legacyHeaders: false });

app.get("/health", (req,res)=>res.json({
  ok:true, guestAccess:true, apiConfigured:Boolean(KEY),
  user: req.session.user ? {id:req.session.user.id,email:req.session.user.email,role:req.session.user.role}:null
}));

app.get("/api/health", (req,res)=>res.json({
  ok:true, guestAccess:true, apiConfigured:Boolean(KEY),
  user: req.session.user ? {id:req.session.user.id,email:req.session.user.email,role:req.session.user.role}:null
}));

app.post("/api/auth/register", authLimiter, async (req,res)=>{
  const email = String(req.body.email||"").trim().toLowerCase();
  const password = String(req.body.password||"");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8)
    return res.status(400).json({error:"Email valid dan password minimal 8 karakter diperlukan."});
  try {
    const hash = await bcrypt.hash(password, 12);
    const info = db.prepare("INSERT INTO users(email,password_hash) VALUES(?,?)").run(email,hash);
    req.session.user = {id:info.lastInsertRowid,email,role:"user"};
    res.json({ok:true,user:req.session.user});
  } catch(e) { res.status(409).json({error:"Email sudah terdaftar."}); }
});
app.post("/api/auth/login", authLimiter, async (req,res)=>{
  const email = String(req.body.email||"").trim().toLowerCase();
  const password = String(req.body.password||"");
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!u || !(await bcrypt.compare(password,u.password_hash))) return res.status(401).json({error:"Email atau password salah."});
  req.session.user = {id:u.id,email:u.email,role:u.role};
  res.json({ok:true,user:req.session.user});
});
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/auth/me",(req,res)=>res.json({user:req.session.user||null}));

app.get("/api/matches", async (req,res)=>{
  try {
    const params = {};
    const mode = req.query.mode || "today";
    if (mode === "live") params.live = "all";
    else params.date = req.query.date || new Date().toISOString().slice(0,10);
    if (req.query.league) params.league = req.query.league;
    if (req.query.season) params.season = req.query.season;
    if (req.query.q) params.search = req.query.q;
    const data = await api("/fixtures",params);
    res.json(data);
  } catch(e) { res.status(502).json({error:e.message}); }
});
app.get("/api/matches/:id", async (req,res)=>{
  try { res.json(await api("/fixtures",{id:req.params.id})); }
  catch(e){res.status(502).json({error:e.message});}
});
app.get("/api/matches/:id/events", async (req,res)=>{
  try { res.json(await api("/fixtures/events",{fixture:req.params.id})); }
  catch(e){res.status(502).json({error:e.message});}
});
app.get("/api/matches/:id/stats", async (req,res)=>{
  try { res.json(await api("/fixtures/statistics",{fixture:req.params.id})); }
  catch(e){res.status(502).json({error:e.message});}
});
app.get("/api/leagues/:id/standings", async (req,res)=>{
  try { res.json(await api("/standings",{league:req.params.id,season:req.query.season||process.env.DEFAULT_SEASON||2026})); }
  catch(e){res.status(502).json({error:e.message});}
});
app.get("/api/leagues/:id/topscorers", async (req,res)=>{
  try { res.json(await api("/players/topscorers",{league:req.params.id,season:req.query.season||process.env.DEFAULT_SEASON||2026})); }
  catch(e){res.status(502).json({error:e.message});}
});
app.get("/api/teams/:id/stats", async (req,res)=>{
  try { res.json(await api("/teams/statistics",{team:req.params.id,league:req.query.league||process.env.DEFAULT_LEAGUE||39,season:req.query.season||process.env.DEFAULT_SEASON||2026})); }
  catch(e){res.status(502).json({error:e.message});}
});

app.get("/api/favorites", requireAuth, (req,res)=>{
  res.json(db.prepare("SELECT fixture_id FROM favorites WHERE user_id=? ORDER BY fixture_id").all(req.session.user.id).map(x=>x.fixture_id));
});
app.post("/api/favorites/:id", requireAuth, (req,res)=>{
  db.prepare("INSERT OR IGNORE INTO favorites(user_id,fixture_id) VALUES(?,?)").run(req.session.user.id,Number(req.params.id));
  res.json({ok:true});
});
app.delete("/api/favorites/:id", requireAuth, (req,res)=>{
  db.prepare("DELETE FROM favorites WHERE user_id=? AND fixture_id=?").run(req.session.user.id,Number(req.params.id));
  res.json({ok:true});
});

app.get("/api/ads",(req,res)=>{
  res.json(db.prepare("SELECT id,name,position,html FROM ad_slots WHERE active=1 ORDER BY id").all());
});
app.get("/api/admin/ads", requireAdmin, (req,res)=>res.json(db.prepare("SELECT * FROM ad_slots ORDER BY id DESC").all()));
app.post("/api/admin/ads", requireAdmin, (req,res)=>{
  const {name,position,html=""}=req.body;
  if(!name||!position) return res.status(400).json({error:"name dan position wajib"});
  const info=db.prepare("INSERT INTO ad_slots(name,position,html) VALUES(?,?,?)").run(String(name),String(position),String(html));
  res.json({id:info.lastInsertRowid});
});
app.put("/api/admin/ads/:id", requireAdmin, (req,res)=>{
  const {name,position,html="",active=1}=req.body;
  db.prepare("UPDATE ad_slots SET name=?,position=?,html=?,active=? WHERE id=?").run(String(name),String(position),String(html),active?1:0,Number(req.params.id));
  res.json({ok:true});
});
app.delete("/api/admin/ads/:id", requireAdmin, (req,res)=>{
  db.prepare("DELETE FROM ad_slots WHERE id=?").run(Number(req.params.id)); res.json({ok:true});
});

app.get("/privacy", (req,res)=>res.sendFile(path.join(__dirname,"public","privacy.html")));
app.get("/terms", (req,res)=>res.sendFile(path.join(__dirname,"public","terms.html")));

app.get("/robots.txt",(req,res)=>res.type("text").send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get("host")}/sitemap.xml\n`));
app.get("/sitemap.xml",(req,res)=>{
  const base = `${req.protocol}://${req.get("host")}`;
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url><url><loc>${base}/league/39</loc></url></urlset>`);
});

app.get("*", (req,res)=>{
  if (req.path.startsWith("/api/") || req.path === "/robots.txt" || req.path === "/sitemap.xml") return res.status(404).end();
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,()=>console.log(`FootballLive V8 running at http://localhost:${PORT}`));
