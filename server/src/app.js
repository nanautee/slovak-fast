import { Hono } from "hono";
import { cors } from "hono/cors";
import { fallbackTopic, localQuiz, FALLBACK_REPLIES } from "./fallback.js";

const DEFAULT_ORIGINS = [
  "https://slovak-fast.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
];

export function createApp({ data, ai, allowedOrigins } = {}) {
  const app = new Hono();

  const allowList = (allowedOrigins || DEFAULT_ORIGINS)
    .map((s) => String(s).trim())
    .filter(Boolean);

  app.use(
    "/api/*",
    cors({
      origin: (origin) => (origin && allowList.includes(origin) ? origin : origin ? null : allowList[0]),
      credentials: false,
    })
  );

  /* ---------- rate limits (best-effort, per-isolate) ---------- */

  function rateLimit(name, max, windowMs) {
    const seen = new Map();
    return async (c, next) => {
      const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
      const now = Date.now();
      const k = `${name}:${ip}`;
      const rec = seen.get(k) || { n: 0, t: now };
      if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
      rec.n++;
      seen.set(k, rec);
      if (rec.n > max) return c.json({ error: "Слишком много запросов. Подожди минуту" }, 429);
      return next();
    };
  }

  app.use("/api/*", rateLimit("g", 300, 60000));
  app.post("/api/bootstrap", rateLimit("b", 10, 600000));
  app.delete("/api/profile", rateLimit("d", 5, 600000));

  /* ---------- helpers ---------- */

  const tokenOf = (c) => c.req.header("x-auth-token") || "";

  /* ---------- health ---------- */

  app.get("/api/health", async (c) =>
    c.json({ ok: true, ai: ai.hasKey(), devices: (await data.listUsers()).length })
  );

  /* ---------- bootstrap: одно устройство = один токен ---------- */

  app.post("/api/bootstrap", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const existing = tokenOf(c);
    if (existing && (await data.getDevice(existing))) {
      return c.json({ ok: true, token: existing, profile: await data.getDevice(existing), existing: true });
    }
    const device = await data.createDevice(name);
    return c.json({ ok: true, token: device.token, profile: device.profile, existing: false });
  });

  app.post("/api/rename", async (c) => {
    const token = tokenOf(c);
    if (!(await data.getDevice(token))) return c.json({ error: "Авторизуйся" }, 401);
    const body = await c.req.json().catch(() => ({}));
    try {
      return c.json({ ok: true, profile: await data.renameDevice(token, String(body.name || "")) });
    } catch (e) {
      return c.json({ error: e.message }, e.status || 500);
    }
  });

  /* ---------- protected: state ---------- */

  app.get("/api/state", async (c) => {
    const token = tokenOf(c);
    const profile = await data.getDevice(token);
    if (!profile) return c.json({ error: "Авторизуйся" }, 401);
    return c.json({ meta: await data.usersMeta(), profiles: { [token]: profile } });
  });

  app.put("/api/state", async (c) => {
    const token = tokenOf(c);
    if (!(await data.getDevice(token))) return c.json({ error: "Авторизуйся" }, 401);
    const body = await c.req.json().catch(() => ({}));
    if (!body || typeof body !== "object") return c.json({ error: "Bad state" }, 400);
    const profile = await data.setProfile(token, body);
    return c.json({ meta: await data.usersMeta(), profiles: { [token]: profile } });
  });

  app.delete("/api/profile", async (c) => {
    const token = tokenOf(c);
    try {
      await data.deleteDevice(token);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: e.message }, e.status || 500);
    }
  });

  /* ---------- public content endpoints ---------- */

  app.post("/api/topic", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const dayNumber = Number(body.dayNumber) || 1;
    const seen = Array.isArray(body.seenTopics) ? body.seenTopics : [];
    if (ai.hasKey()) {
      try {
        const t = await ai.generateTopicJson(dayNumber, seen);
        if (t && Array.isArray(t.words) && t.words.length >= 4) {
          return c.json({
            sk: t.topic || t.topicSk || "",
            ru: t.topicRu || "",
            words: t.words.slice(0, 15).map((w) => ({ sk: w.sk, ru: w.ru })),
            example: t.example || "",
          });
        }
      } catch (e) {
        console.error("groq topic failed:", e.message);
      }
    }
    return c.json(fallbackTopic(dayNumber, seen));
  });

  app.post("/api/quiz", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    let questions = [];
    if (ai.hasKey()) {
      try {
        questions = await ai.generateQuizJson(body.topic);
      } catch (e) {
        console.error("groq quiz failed:", e.message);
      }
    }
    if (questions.length < 10) {
      const seen = new Set(questions.map((q) => q.q.toLowerCase().trim()));
      for (const q of localQuiz(body.topic)) {
        if (questions.length >= 10) break;
        const key = q.q.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        questions.push(q);
      }
    }
    return c.json({ questions: questions.slice(0, 10) });
  });

  app.post("/api/chat", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const topic = body.topic || {};
    const msgs = Array.isArray(body.msgs) ? body.msgs : [];
    const opener = body.opener || "";
    if (ai.hasKey()) {
      try {
        const reply = await ai.chatReply(topic, msgs, opener);
        if (reply) return c.json({ reply });
      } catch (e) {
        console.error("groq chat failed:", e.message);
      }
    }
    const dayNumber = Number(body.dayNumber) || 1;
    const pool = FALLBACK_REPLIES;
    const reply = pool[(dayNumber + msgs.length) % pool.length]
      .replace("{topic}", topic.ru || "")
      .replace("{word}", topic.words?.[0]?.sk || "");
    return c.json({ reply });
  });

  return app;
}
