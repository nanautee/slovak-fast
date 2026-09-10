const BASE = typeof import.meta.env !== "undefined" ? import.meta.env.VITE_API_URL || "" : "";

export const TOKEN_KEY = "sf_token";
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (e) {
    return "";
  }
}
export function setToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { ...options, headers });
  if (r.status === 401) throw new AuthError("Не авторизован");
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

export const api = {
  register: (name, pin) => request("/api/auth/register", { method: "POST", body: JSON.stringify({ name, pin }) }),
  login: (name, pin) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ name, pin }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }).catch(() => ({ ok: true })),
  state: () => request("/api/state"),
  save: (profile) => request("/api/state", { method: "PUT", body: JSON.stringify(profile) }),
  topic: (dayNumber, seenTopics) => request("/api/topic", { method: "POST", body: JSON.stringify({ dayNumber, seenTopics }) }),
  quiz: (topic) => request("/api/quiz", { method: "POST", body: JSON.stringify({ topic }) }),
  chat: (topic, msgs, opener, dayNumber) =>
    request("/api/chat", { method: "POST", body: JSON.stringify({ topic, msgs, opener, dayNumber }) }),
};