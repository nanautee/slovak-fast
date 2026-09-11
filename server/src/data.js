import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
        tokens: (raw && raw.tokens) ? raw.tokens : {},
      };
      return db;
    }
  } catch (e) {
    console.error("data store corrupted, starting fresh:", e.message);
  }
  db = { profiles: {}, pins: {}, tokens: {} };
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

export function listUsers() {
  return Object.entries(load().profiles).map(([id, p]) => ({ id, name: (p && p.name) || "" }));
}

export function getProfile(id) {
  return load().profiles[id] || null;
}

/* ---------- credentials ---------- */

export function hasPassword(id) {
  return !!load().pins[id];
}

export function verifyPassword(id, password) {
  return hashSecret(password) === load().pins[id];
}

export function createProfile(name, password) {
  const d = load();
  const id = randomUUID();
  const key = name.trim().toLowerCase();
  if (Object.values(d.profiles).some((p) => (p.name || "").trim().toLowerCase() === key)) {
    throw Object.assign(new Error("Имя уже занято"), { status: 409 });
  }
  d.profiles[id] = sanitize(seedProfile(name.trim()));
  d.pins[id] = hashSecret(password || "");
  persist();
  return { id, name: name.trim() };
}

export function setPassword(id, password) {
  const d = load();
  if (!d.profiles[id]) throw Object.assign(new Error("Профиль не найден"), { status: 404 });
  d.pins[id] = hashSecret(password || "");
  persist();
}

/* ---------- tokens ---------- */

const MAX_TOKENS = 8;

export function issueToken(id) {
  const d = load();
  if (!d.profiles[id]) throw Object.assign(new Error("Профиль не найден"), { status: 404 });
  const raw = randomBytes(32).toString("hex");
  const list = d.tokens[id] || [];
  list.push(hashSecret(raw));
  d.tokens[id] = list.slice(-MAX_TOKENS);
  persist();
  return raw;
}

export function verifyToken(id, raw) {
  if (!raw || !id) return false;
  return (load().tokens[id] || []).includes(hashSecret(raw));
}

export function clearToken(id, raw) {
  const d = load();
  if (!raw || !d.tokens[id]) return;
  const list = (d.tokens[id] || []).filter((h) => h !== hashSecret(raw));
  if (list.length) d.tokens[id] = list;
  else delete d.tokens[id];
  persist();
}

/* ---------- profiles ---------- */

export function usersMeta() {
  return { profiles: listUsers() };
}

export function setProfile(id, profile) {
  load();
  const prev = getProfile(id) || {};
  const name = (profile && profile.name) || prev.name || "";
  db.profiles[id] = sanitize({ ...(profile || {}), name });
  persist();
  return db.profiles[id];
}

export function deleteProfile(id, raw) {
  load();
  if (!db.profiles[id]) throw Object.assign(new Error("Профиль не найден"), { status: 404 });
  if (!verifyToken(id, raw)) throw Object.assign(new Error("Нет прав на удаление этого профиля"), { status: 401 });
  delete db.profiles[id];
  delete db.pins[id];
  delete db.tokens[id];
  persist();
}