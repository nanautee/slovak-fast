/* Общая логика профилей/токенов. Не зависит от платформы (Node и Workers). */

export function seedProfile(name = "") {
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

export function sanitize(p) {
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

export function cleanName(name) {
  const n = String(name || "").trim();
  if (n.length < 1) throw Object.assign(new Error("Имя слишком короткое"), { status: 400 });
  if (n.length > 20) throw Object.assign(new Error("Имя слишком длинное"), { status: 400 });
  return n;
}

export function randomToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function hashSecret(secret) {
  const data = new TextEncoder().encode(String(secret || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
