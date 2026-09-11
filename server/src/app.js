import { Hono } from "hono";
import { cors } from "hono/cors";
import { getProfile, setProfile, createProfile, deleteProfile, usersMeta, listUsers } from "./data.js";
import { hasKey, generateTopicJson, generateQuizJson, chatReply } from "./ai.js";
import { fallbackTopic, localQuiz, FALLBACK_REPLIES } from "./fallback.js";

export const app = new Hono();

const allowList = (process.env.ALLOWED_ORIGINS || [
  "https://slovak-fast.vercel.app",
  "https://slovak-fast-production.up.railway.app",
  "http://localhost:5173",
  "http://localhost:4173",
]).map((s) => String(s).trim()).filter(Boolean);

app.use(
  "/api/*",
  cors({
    origin: (origin) => (origin && allowList.includes(origin) ? origin : origin ? null : allowList[0]),
    credentials: false,
  })
);

function rateLimit(name, max, windowMs) {
  const seen = new Map();
  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const k = `${name}:${ip}`;
    const rec = seen.get(k) || { n: 0, t: now };
    if (now - rec.t > windowMs) {
      rec.n = 0;
      rec.t = now;
    }
    rec.n++;
    seen.set(k, rec);
    if (rec.n > max) return c.json({ error: "Слишком много запросов. Подожди минуту" }, 429);
    return next();
  };
}

app.use("/api/*", rateLimit("g", 300, 60000));
app.post("/api/profile", rateLimit("p", 10, 600000));
app.delete("/api/profile/*", rateLimit("d", 5, 600000));

app.get("/api/health", (c) =>
  c.json({ ok: true, ai: hasKey(), users: listUsers().map((u) => u.name) })
);

app.get("/api/state", (c) =>
  c.json({ meta: usersMeta(), profiles: profileBundle() })
);

app.put("/api/state", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body || typeof body !== "object") return c.json({ error: "Bad state" }, 400);
  const id = String(body.id || "");
  if (!id) return c.json({ error: "Нет id профиля" }, 400);
  setProfile(id, body);
  return c.json({ meta: usersMeta(), profiles: profileBundle() });
});

app.post("/api/profile", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = String(body.id || "");
  const name = String(body.name || "").trim();
  if (!id) return c.json({ error: "Нет id профиля" }, 400);
  if (!name || name.length < 2) return c.json({ error: "Имя слишком короткое" }, 400);
  try {
    createProfile(id, name, body.pin);
    return c.json({ ok: true, profile: { id, name } });
  } catch (e) {
    return c.json({ error: e.message }, e.status || 500);
  }
});

function profileBundle() {
  const bundle = {};
  for (const u of listUsers()) {
    const p = getProfile(u.id);
    if (p) bundle[u.id] = p;
  }
  return bundle;
}

app.delete("/api/profile/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  try {
    deleteProfile(id, body.pin);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e.message }, e.status || 500);
  }
});

app.post("/api/topic", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const dayNumber = Number(body.dayNumber) || 1;
  const seen = Array.isArray(body.seenTopics) ? body.seenTopics : [];
  if (hasKey()) {
    try {
      const t = await generateTopicJson(dayNumber, seen);
      if (t && Array.isArray(t.words) && t.words.length >= 4) {
        return c.json({
          sk: t.topic || t.topicSk || "",
          ru: t.topicRu || "",
          words: t.words.slice(0, 10).map((w) => ({ sk: w.sk, ru: w.ru })),
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
  if (hasKey()) {
    try {
      const qs = await generateQuizJson(body.topic);
      if (qs.length) return c.json({ questions: qs });
    } catch (e) {
      console.error("groq quiz failed:", e.message);
    }
  }
  return c.json({ questions: localQuiz(body.topic) });
});

app.post("/api/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const topic = body.topic || {};
  const msgs = Array.isArray(body.msgs) ? body.msgs : [];
  const opener = body.opener || "";
  if (hasKey()) {
    try {
      const reply = await chatReply(topic, msgs, opener);
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