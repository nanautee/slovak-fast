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
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

export const USER_KEY = "sf_user";
export const TOKEN_KEY = "sf_token";

export function getUserId() {
  try { return localStorage.getItem(USER_KEY) || ""; } catch { return ""; }
}
export function setUserId(id) {
  try { if (id) localStorage.setItem(USER_KEY, id); else localStorage.removeItem(USER_KEY); } catch {}
}
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function authHeaders() {
  return { "x-user-id": getUserId(), "x-auth-token": getToken() };
}

export const api = {
  users: () => request("/api/users"),
  register: (name, password) => request("/api/auth/register", { method: "POST", body: JSON.stringify({ name, password }) }),
  login: (id, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ id, password }) }),
  setPassword: (password) => request("/api/auth/set-password", { method: "POST", body: JSON.stringify({ password }), headers: authHeaders() }),

  state: () => request("/api/state", { headers: authHeaders() }),
  save: (id, profile) => request("/api/state", { method: "PUT", body: JSON.stringify({ id, ...profile }), headers: authHeaders() }),
  deleteProfile: (id) => request(`/api/profile/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() }),

  topic: (dayNumber, seenTopics) => request("/api/topic", { method: "POST", body: JSON.stringify({ dayNumber, seenTopics }) }),
  quiz: (topic) => request("/api/quiz", { method: "POST", body: JSON.stringify({ topic }) }),
  chat: (topic, msgs, opener, dayNumber) =>
    request("/api/chat", { method: "POST", body: JSON.stringify({ topic, msgs, opener, dayNumber }) }),
};