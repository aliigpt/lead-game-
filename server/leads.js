// Email gate: stores name + email, hands back a signed play token.
// Leads go to DATA_DIR/leads.jsonl and, if LEADS_WEBHOOK_URL is set, are also
// POSTed there as JSON (Zapier, Make, Google Apps Script, your CRM, ...).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");
const WEBHOOK = process.env.LEADS_WEBHOOK_URL || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

fs.mkdirSync(DATA_DIR, { recursive: true });

// Signing secret: env var, else a random one persisted in DATA_DIR so tokens
// survive restarts on the same disk.
function loadSecret() {
  if (process.env.TOKEN_SECRET) return process.env.TOKEN_SECRET;
  const f = path.join(DATA_DIR, ".token-secret");
  try {
    return fs.readFileSync(f, "utf8").trim();
  } catch {
    const s = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(f, s, { mode: 0o600 });
    return s;
  }
}
const SECRET = loadSecret();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanName(raw) {
  return String(raw || "")
    .replace(/[^\p{L}\p{N} _.\-]/gu, "")
    .trim()
    .slice(0, 16);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

// Tiny per-IP rate limit for the signup endpoint.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 8;
}

export function registerLeadRoutes(app, express) {
  app.post("/api/lead", express.json({ limit: "4kb" }), async (req, res) => {
    if (limited(req.ip)) return res.status(429).json({ error: "Slow down a sec and try again." });
    const name = cleanName(req.body?.name);
    const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 254);
    const consent = req.body?.consent === true;
    if (!name) return res.status(400).json({ error: "Pick a player name." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "That email doesn't look right." });
    if (!consent) return res.status(400).json({ error: "Tick the box to unlock the game." });

    const lead = {
      name,
      email,
      consent,
      ts: new Date().toISOString(),
      ref: String(req.body?.ref || "").slice(0, 120),
    };
    fs.appendFile(LEADS_FILE, JSON.stringify(lead) + "\n", (err) => {
      if (err) console.error("lead write failed", err);
    });
    if (WEBHOOK) {
      fetch(WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
      }).catch((err) => console.error("lead webhook failed", err.message));
    }
    res.json({ token: sign({ n: name, e: email, t: Date.now() }), name });
  });

  // Download leads as CSV: /api/leads.csv?key=YOUR_ADMIN_KEY
  app.get("/api/leads.csv", (req, res) => {
    if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(404).end();
    let rows = [];
    try {
      rows = fs.readFileSync(LEADS_FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    } catch {}
    // quote fields and defuse spreadsheet formulas
    const esc = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = ["name,email,consent,ts,ref", ...rows.map((r) => [r.name, r.email, r.consent, r.ts, r.ref].map(esc).join(","))].join("\n");
    res.setHeader("content-type", "text/csv");
    res.setHeader("content-disposition", 'attachment; filename="leads.csv"');
    res.send(csv);
  });
}
