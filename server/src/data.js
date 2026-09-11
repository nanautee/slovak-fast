import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname } from "node:path";

const dataDir = () => process.env.DATA_DIR || "./data";
const dbFile = () => process.env.DB_FILE || `${dataDir()}/store.json`;

let db = null;

function seedProfile(name = "") {
  return {
    name,
    dayNumber: 1,
    streak: 0,
    lastDoneDate: null,
    topicDate: null,
    topic: null,
    today: {
      cards: { done: false, correct: 0, total: 0 },
      chat: { done: false, lines: 0, msgs: [], opener: "" },
      quiz: { done: false, correct: 0, total: 0, questions: [], answers: [], answered: 0 },
      listen: { done: false, correct: 0, total: 0, questions: [], answered: 0 },
    },
    words: [],
    history: [],
    seenTopics: [],
  };
}

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

function hashSecret(secret) {
  return createHash("sha256").update(String(secret || "")).digest("hex");
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

function sanitize(p) {
  const base = seedProfile(p && p.name);
  return {
    ...base,
    ...(p || {}),
    today: { ...base.today, ...((p && p.today) || {}) },
    words: Array.isArray(p && p.words) ? p.words : [],
    history: Array.isArray(p && p.history) ? p.history : [],
    seenTopics: Array.isArray(p && p.seenTopics) ? p.seenTopics : [],
  };
}

/* ---------- device = профиль ---------- */

export function listUsers() {
  return Object.entries(load().profiles).map(([id, p]) => ({ id, name: (p && p.name) || "" }));
}

export function usersMeta() {
  return { profiles: listUsers() };
}

export function deviceExists(tok) {
  if (!tok) return false;
  return !!load().profiles[tok] && load().pins[tok] === hashSecret(tok);
}

export function createDevice(name) {
  const d = load();
  const token = randomBytes(32).toString("hex");
  const cleanName = String(name || "").trim() || "Игрок";
  d.profiles[token] = sanitize(seedProfile(cleanName));
  d.pins[token] = hashSecret(token);
  persist();
  return { token, profile: d.profiles[token] };
}

export function getDevice(tok) {
  if (!deviceExists(tok)) return null;
  return load().profiles[tok];
}

export function renameDevice(tok, name) {
  const d = load();
  if (!deviceExists(tok)) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
  const cleanName = String(name || "").trim();
  if (cleanName.length < 1) throw Object.assign(new Error("Имя слишком короткое"), { status: 400 });
  if (cleanName.length > 20) throw Object.assign(new Error("Имя слишком длинное"), { status: 400 });
  d.profiles[tok] = sanitize({ ...d.profiles[tok], name: cleanName });
  persist();
  return d.profiles[tok];
}

export function setProfile(tok, profile) {
  const d = load();
  if (!deviceExists(tok)) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
  const prev = d.profiles[tok];
  d.profiles[tok] = sanitize({ ...(profile || {}), name: prev.name });
  persist();
  return d.profiles[tok];
}

export function deleteDevice(tok) {
  const d = load();
  if (!deviceExists(tok)) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
  delete d.profiles[tok];
  delete d.pins[tok];
  persist();
}