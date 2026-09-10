import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const dataDir = () => process.env.DATA_DIR || "./data";
const dbFile = () => process.env.DB_FILE || `${dataDir()}/store.json`;

let db = null;

function seedProfile(name) {
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

function load() {
  if (db) return db;
  try {
    if (existsSync(dbFile())) {
      db = JSON.parse(readFileSync(dbFile(), "utf8"));
      if (!db.users || !db.profiles) throw new Error("bad shape");
      return db;
    }
  } catch (e) {
    console.error("data store corrupted, starting fresh:", e.message);
  }
  db = { users: [], sessions: {}, profiles: {} };
  return db;
}

function persist() {
  mkdirSync(dirname(dbFile()), { recursive: true });
  writeFileSync(dbFile() + ".tmp", JSON.stringify(db, null, 2));
  writeFileSync(dbFile(), JSON.stringify(db, null, 2));
}

export function hashPin(pin, salt) {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

export function listUsers() {
  return load().users.map((u) => ({ id: u.id, name: u.name }));
}

export function createUser(name, pin) {
  const d = load();
  const key = name.trim().toLowerCase();
  if (d.users.some((u) => u.name.toLowerCase() === key)) {
    const err = new Error("Имя уже занято");
    err.status = 409;
    throw err;
  }
  const user = { id: randomUUID(), name: name.trim(), salt: randomBytes(16).toString("hex"), pinHash: "" };
  user.pinHash = hashPin(pin, user.salt);
  d.users.push(user);
  d.profiles[user.id] = seedProfile(user.name);
  persist();
  return { id: user.id, name: user.name };
}

export function findUser(name, pin) {
  const d = load();
  const user = d.users.find((u) => u.name.toLowerCase() === name.trim().toLowerCase());
  if (!user) return null;
  if (hashPin(pin, user.salt) !== user.pinHash) return null;
  return user;
}

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  load().sessions[token] = userId;
  persist();
  return token;
}

export function deleteSession(token) {
  const d = load();
  if (d.sessions[token]) delete d.sessions[token];
  persist();
}

export function userIdByToken(token) {
  return load().sessions[token] || null;
}

export function getUser(id) {
  return load().users.find((u) => u.id === id) || null;
}

export function getProfile(userId) {
  const d = load();
  return d.profiles[userId] || seedProfile("?");
}

export function getOtherProfile(userId) {
  const d = load();
  const other = d.users.find((u) => u.id !== userId);
  return other ? d.profiles[other.id] || seedProfile(other.name) : null;
}

export function usersMeta(userId) {
  const d = load();
  return {
    active: userId,
    profiles: d.users.map((u) => ({ id: u.id, name: u.name })),
  };
}

export function setProfile(userId, profile) {
  const d = load();
  d.profiles[userId] = sanitize(profile);
  persist();
  return d.profiles[userId];
}

function sanitize(p) {
  const base = seedProfile("?");
  return {
    ...base,
    ...p,
    today: { ...base.today, ...(p.today || {}) },
    words: Array.isArray(p.words) ? p.words : [],
    history: Array.isArray(p.history) ? p.history : [],
    seenTopics: Array.isArray(p.seenTopics) ? p.seenTopics : [],
  };
}