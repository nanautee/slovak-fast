import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { seedProfile, sanitize, cleanName, randomToken, hashSecret } from "./store-core.js";

const dataDir = () => process.env.DATA_DIR || "./data";
const dbFile = () => process.env.DB_FILE || `${dataDir()}/store.json`;

let db = null;

function legacyProfiles(raw) {
  const out = {};
  if (raw && raw.profiles && typeof raw.profiles === "object") {
    for (const [id, p] of Object.entries(raw.profiles)) {
      if (!p || typeof p !== "object") continue;
      let name = "Игрок";
      if (Array.isArray(raw.users)) {
        const u = raw.users.find((x) => x.id === id);
        if (u && u.name) name = u.name;
      }
      out[id] = sanitize({ ...p, name });
    }
  }
  return out;
}

function load() {
  if (db) return db;
  try {
    if (existsSync(dbFile())) {
      const raw = JSON.parse(readFileSync(dbFile(), "utf8"));
      db = {
        profiles: legacyProfiles(raw),
        pins: (raw && raw.pins) ? raw.pins : {},
      };
      return db;
    }
  } catch (e) {
    console.error("data store corrupted, starting fresh:", e.message);
  }
  db = { profiles: {}, pins: {} };
  return db;
}

function persist() {
  mkdirSync(dirname(dbFile()), { recursive: true });
  writeFileSync(dbFile() + ".tmp", JSON.stringify(db, null, 2));
  writeFileSync(dbFile(), JSON.stringify(db, null, 2));
}

/* ---------- device = профиль ---------- */

export async function listUsers() {
  return Object.entries(load().profiles).map(([id, p]) => ({ id, name: (p && p.name) || "" }));
}

export async function usersMeta() {
  return { profiles: await listUsers() };
}

export async function deviceExists(tok) {
  if (!tok) return false;
  return !!load().profiles[tok] && load().pins[tok] === (await hashSecret(tok));
}

export async function createDevice(name) {
  const d = load();
  const token = randomToken();
  const clean = String(name || "").trim() || "Игрок";
  d.profiles[token] = sanitize(seedProfile(clean));
  d.pins[token] = await hashSecret(token);
  persist();
  return { token, profile: d.profiles[token] };
}

export async function getDevice(tok) {
  if (!(await deviceExists(tok))) return null;
  return load().profiles[tok];
}

export async function renameDevice(tok, name) {
  const d = load();
  if (!(await deviceExists(tok))) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
  d.profiles[tok] = sanitize({ ...d.profiles[tok], name: cleanName(name) });
  persist();
  return d.profiles[tok];
}

export async function setProfile(tok, profile) {
  const d = load();
  if (!(await deviceExists(tok))) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
  const prev = d.profiles[tok];
  d.profiles[tok] = sanitize({ ...(profile || {}), name: prev.name });
  persist();
  return d.profiles[tok];
}

export async function deleteDevice(tok) {
  const d = load();
  if (!(await deviceExists(tok))) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
  delete d.profiles[tok];
  delete d.pins[tok];
  persist();
}
