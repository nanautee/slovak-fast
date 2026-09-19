import { seedProfile, sanitize, cleanName, randomToken, hashSecret } from "./store-core.js";

/* Хранилище на Cloudflare D1. Одна строка = одно устройство (профиль). */
export function makeD1Data(DB) {
  const first = (sql, ...args) => DB.prepare(sql).bind(...args).first();
  const run = (sql, ...args) => DB.prepare(sql).bind(...args).run();

  async function listUsers() {
    const { results } = await DB.prepare(
      "SELECT token, name FROM devices ORDER BY updated_at ASC"
    ).all();
    return (results || []).map((r) => ({ id: r.token, name: r.name || "" }));
  }

  async function loadAuthed(tok) {
    if (!tok) return null;
    const pin = await hashSecret(tok);
    const row = await first("SELECT pin, name, profile FROM devices WHERE token = ?", tok);
    if (!row || row.pin !== pin) return null;
    return row;
  }

  return {
    listUsers,
    async usersMeta() {
      return { profiles: await listUsers() };
    },
    async deviceExists(tok) {
      return !!(await loadAuthed(tok));
    },
    async createDevice(name) {
      const token = randomToken();
      const clean = String(name || "").trim() || "Игрок";
      const profile = sanitize(seedProfile(clean));
      const pin = await hashSecret(token);
      await run(
        "INSERT INTO devices (token, pin, name, profile, updated_at) VALUES (?, ?, ?, ?, ?)",
        token, pin, clean, JSON.stringify(profile), Date.now()
      );
      return { token, profile };
    },
    async getDevice(tok) {
      const row = await loadAuthed(tok);
      if (!row) return null;
      try { return sanitize(JSON.parse(row.profile)); } catch { return null; }
    },
    async renameDevice(tok, name) {
      const row = await loadAuthed(tok);
      if (!row) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
      const clean = cleanName(name);
      const profile = sanitize({ ...JSON.parse(row.profile), name: clean });
      await run(
        "UPDATE devices SET name = ?, profile = ?, updated_at = ? WHERE token = ?",
        clean, JSON.stringify(profile), Date.now(), tok
      );
      return profile;
    },
    async setProfile(tok, profile) {
      const row = await loadAuthed(tok);
      if (!row) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
      const next = sanitize({ ...(profile || {}), name: row.name });
      await run(
        "UPDATE devices SET profile = ?, updated_at = ? WHERE token = ?",
        JSON.stringify(next), Date.now(), tok
      );
      return next;
    },
    async deleteDevice(tok) {
      const row = await loadAuthed(tok);
      if (!row) throw Object.assign(new Error("Нет токена устройства"), { status: 401 });
      await run("DELETE FROM devices WHERE token = ?", tok);
    },
  };
}
