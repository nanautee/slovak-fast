import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createUser,
  findUser,
  createSession,
  deleteSession,
  userIdByToken,
  getUser,
  getProfile,
  getOtherProfile,
  usersMeta,
  setProfile,
  listUsers,
} from "./data.js";
import { hasKey, generateTopicJson, generateQuizJson, chatReply } from "./ai.js";
import { fallbackTopic, localQuiz, FALLBACK_REPLIES } from "./fallback.js";

export const app = new Hono();

app.use("/api/*", cors({ origin: (o) => o || "*", credentials: false }));

app.get("/api/health", (c) =>
  c.json({ ok: true, ai: hasKey(), users: listUsers().map((u) => u.name) })
);

app.get("/api/debug/models", async (c) => {
  const key = process.env.GROQ_API_KEY || "";
  if (!key) return c.json({ error: "no key" }, 500);
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const j = await r.json();
    return c.json({ status: r.status, data: (j.data || []).map((m) => m.id) });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

function requireAuth(c) {
  const auth = c.req.header("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const uid = userIdByToken(token);
  if (!uid) return null;
  return uid;
}

app.post("/api/auth/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const pin = String(body.pin || "");
  if (!name || name.length < 2) return c.json({ error: "Имя слишком короткое" }, 400);
  if (!pin || pin.length < 4) return c.json({ error: "ПИН минимум 4 символа" }, 400);
  try {
    const user = createUser(name, pin);
    const token = createSession(user.id);
    return c.json({ token, user: { id: user.id, name: user.name } });
  } catch (e) {
    return c.json({ error: e.message }, e.status || 500);
  }
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const user = findUser(String(body.name || ""), String(body.pin || ""));
  if (!user) return c.json({ error: "Неверное имя или ПИН" }, 401);
  const token = createSession(user.id);
  return c.json({ token, user: { id: user.id, name: user.name } });
});

app.post("/api/auth/logout", (c) => {
  const uid = requireAuth(c);
  if (uid) {
    const auth = c.req.header("Authorization") || "";
    deleteSession(auth.replace(/^Bearer\s+/i, ""));
  }
  return c.json({ ok: true });
});

app.get("/api/state", (c) => {
  const uid = requireAuth(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  return c.json({
    meta: usersMeta(uid),
    profiles: profileBundle(uid),
  });
});

app.put("/api/state", async (c) => {
  const uid = requireAuth(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  if (!body || typeof body !== "object") return c.json({ error: "Bad state" }, 400);
  setProfile(uid, body);
  return c.json({
    meta: usersMeta(uid),
    profiles: profileBundle(uid),
  });
});

function profileBundle(uid) {
  const bundle = {};
  for (const u of listUsers()) bundle[u.id] = getProfile(u.id);
  return bundle;
}

app.post("/api/topic", async (c) => {
  const uid = requireAuth(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
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
  const uid = requireAuth(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
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
  const uid = requireAuth(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
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