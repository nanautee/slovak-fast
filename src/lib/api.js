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

export const api = {
  state: () => request("/api/state"),
  save: (profile) => request("/api/state", { method: "PUT", body: JSON.stringify(profile) }),
  topic: (dayNumber, seenTopics) => request("/api/topic", { method: "POST", body: JSON.stringify({ dayNumber, seenTopics }) }),
  quiz: (topic) => request("/api/quiz", { method: "POST", body: JSON.stringify({ topic }) }),
  chat: (topic, msgs, opener, dayNumber) =>
    request("/api/chat", { method: "POST", body: JSON.stringify({ topic, msgs, opener, dayNumber }) }),
};