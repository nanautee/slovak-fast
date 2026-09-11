const BASE = typeof import.meta.env !== "undefined" ? import.meta.env.VITE_API_URL || "" : "";

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const r = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!r.ok) {
    let msg = `Ошибка ${r.status}`;
    try {
      const j = await r.json();
      if (j && j.error) msg = j.error;
    } catch (e) {}
    throw new Error(msg);
  }
  return r.json();
}

export const USER_KEY = "sf_user";
export const PIN_KEY = "sf_pins";

export function getUserId() {
  try {
    return localStorage.getItem(USER_KEY) || "";
  } catch (e) {
    return "";
  }
}
export function setUserId(id) {
  try {
    if (id) localStorage.setItem(USER_KEY, id);
    else localStorage.removeItem(USER_KEY);
  } catch (e) {}
}
export function getPins() {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY) || "{}");
  } catch (e) {
    return {};
  }
}
export function setPins(pins) {
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify(pins));
  } catch (e) {}
}
export function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

export const api = {
  state: () => request("/api/state"),
  createProfile: (id, name, pin) => request("/api/profile", { method: "POST", body: JSON.stringify({ id, name, pin }) }),
  deleteProfile: (id, pin) => request(`/api/profile/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ pin }) }),
  save: (id, profile) => request("/api/state", { method: "PUT", body: JSON.stringify({ id, ...profile }) }),
  topic: (dayNumber, seenTopics) => request("/api/topic", { method: "POST", body: JSON.stringify({ dayNumber, seenTopics }) }),
  quiz: (topic) => request("/api/quiz", { method: "POST", body: JSON.stringify({ topic }) }),
  chat: (topic, msgs, opener, dayNumber) =>
    request("/api/chat", { method: "POST", body: JSON.stringify({ topic, msgs, opener, dayNumber }) }),
};