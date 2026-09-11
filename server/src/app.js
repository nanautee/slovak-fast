import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  getProfile, setProfile, createProfile, deleteProfile,
  usersMeta, listUsers,
  issueToken, verifyToken, hasPassword, verifyPassword, setPassword,
} from "./data.js";
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

/* ---------- rate limits ---------- */

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
app.post("/api/auth/register", rateLimit("a", 10, 600000));
app.post("/api/auth/login", rateLimit("l", 30, 600000));
app.delete("/api/profile/*", rateLimit("d", 5, 600000));

/* ---------- helpers ---------- */

function authHeaders(c) {
  const id = c.req.header("x-user-id") || "";
  const token = c.req.header("x-auth-token") || "";
  return { id, token };
}

function requireAuth(c) {
  const { id, token } = authHeaders(c);
  if (!id || !verifyToken(id, token)) return null;
  return { id, token };
}

/* ---------- health ---------- */

app.get("/api/health", (c) =>
  c.json({ ok: true, ai: hasKey(), users: listUsers().map((u) => u.name) })
);

/* ---------- public: user list (for picker) ---------- */

app.get("/api/users", (c) => c.json({ profiles: usersMeta().profiles }));

/* ---------- auth ---------- */

app.post("/api/auth/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  if (name.length < 2) return c.json({ error: "Имя слишком короткое" }, 400);
  if (password.length < 4) return c.json({ error: "Пароль ≥ 4 символов" }, 400);
  try {
    const profile = createProfile(name, password);
    const token = issueToken(profile.id);
    return c.json({ ok: true, id: profile.id, name: profile.name, token });
  } catch (e) {
    return c.json({ error: e.message }, e.status || 500);
  }
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = String(body.id || "");
  const password = String(body.password || "");
  if (!id) return c.json({ error: "Нет id" }, 400);
  const profile = getProfile(id);
  if (!profile) return c.json({ error: "Профиль не найден" }, 404);
  if (password.length < 1) return c.json({ error: "Введите пароль" }, 400);
  const had = hasPassword(id);
  if (had && !verifyPassword(id, password)) {
    return c.json({ error: "Неверный пароль" }, 403);
  }
  if (!had) setPassword(id, password);
  const token = issueToken(id);
  return c.json({ ok: true, id, name: profile.name, token, needsPassword: !had });
});

app.post("/api/auth/set-password", async (c) => {
  const { id, token } = authHeaders(c);
  if (!id || !verifyToken(id, token)) return c.json({ error: "Авторизуйся" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const password = String(body.password || "");
  if (password.length < 4) return c.json({ error: "Пароль ≥ 4 символов" }, 400);
  setPassword(id, password);
  return c.json({ ok: true });
});

/* ---------- protected: state ---------- */

app.get("/api/state", (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: "Авторизуйся" }, 401);
  const p = getProfile(auth.id);
  if (!p) return c.json({ error: "Профиль не найден" }, 404);
  return c.json({ meta: usersMeta(), profiles: { [auth.id]: p } });
});

app.put("/api/state", async (c) => {
  const auth = requireAuth(c);
  if (!auth) return c.json({ error: "Авторизуйся" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id || id !== auth.id) return c.json({ error: "Несовпадение профиля" }, 403);
  setProfile(id, body);
  const p = getProfile(id);
  return c.json({ meta: usersMeta(), profiles: { [id]: p } });
});

/* ---------- protected: delete ---------- */

app.delete("/api/profile/:id", async (c) => {
  const id = c.req.param("id");
  const { token } = authHeaders(c);
  try {
    deleteProfile(id, token);
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