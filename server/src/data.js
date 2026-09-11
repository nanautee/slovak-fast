import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const dataDir = () => process.env.DATA_DIR || "./data";
const dbFile = () => process.env.DB_FILE || `${dataDir()}/store.json`;

export const SELF_ID = "self";

let db = null;

function seedProfile() {
  return {
    name: "",
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

function legacyProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.profiles) {
    const keys = Object.keys(raw.profiles);
    if (keys.length) return raw.profiles[keys[0]];
  }
  return null;
}

function load() {
  if (db) return db;
  try {
    if (existsSync(dbFile())) {
      const raw = JSON.parse(readFileSync(dbFile(), "utf8"));
      db = { self: sanitize(legacyProfile(raw)) };
      return db;
    }
  } catch (e) {
    console.error("data store corrupted, starting fresh:", e.message);
  }
  db = { self: seedProfile() };
  return db;
}

function persist() {
  mkdirSync(dirname(dbFile()), { recursive: true });
  writeFileSync(dbFile() + ".tmp", JSON.stringify(db, null, 2));
  writeFileSync(dbFile(), JSON.stringify(db, null, 2));
}

function sanitize(p) {
  const base = seedProfile();
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
  return [{ id: SELF_ID, name: "Профиль" }];
}

export function getProfile() {
  return load().self;
}

export function usersMeta() {
  return { active: SELF_ID, profiles: [{ id: SELF_ID, name: "Профиль" }] };
}

export function setProfile(profile) {
  load();
  db.self = sanitize(profile);
  persist();
  return db.self;
}