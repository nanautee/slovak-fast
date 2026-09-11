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

export const TOKEN_KEY = "sf_token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

function authHeaders() {
  return { "x-auth-token": getToken() };
}

export const api = {
  bootstrap: (name) => request("/api/bootstrap", { method: "POST", body: JSON.stringify({ name }) }),
  rename: (name) => request("/api/rename", { method: "POST", body: JSON.stringify({ name }), headers: authHeaders() }),

  state: () => request("/api/state", { headers: authHeaders() }),
  save: (profile) => request("/api/state", { method: "PUT", body: JSON.stringify(profile), headers: authHeaders() }),
  deleteProfile: () => request("/api/profile", { method: "DELETE", headers: authHeaders() }),

  topic: (dayNumber, seenTopics) => request("/api/topic", { method: "POST", body: JSON.stringify({ dayNumber, seenTopics }) }),
  quiz: (topic) => request("/api/quiz", { method: "POST", body: JSON.stringify({ topic }) }),
  chat: (topic, msgs, opener, dayNumber) =>
    request("/api/chat", { method: "POST", body: JSON.stringify({ topic, msgs, opener, dayNumber }) }),
};