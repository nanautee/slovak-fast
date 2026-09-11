import { Hono } from "hono";
import { cors } from "hono/cors";
import { getProfile, setProfile, createProfile, deleteProfile, usersMeta, listUsers } from "./data.js";
import { hasKey, generateTopicJson, generateQuizJson, chatReply } from "./ai.js";
import { fallbackTopic, localQuiz, FALLBACK_REPLIES } from "./fallback.js";

export const app = new Hono();

app.use("/api/*", cors({ origin: (o) => o || "*", credentials: false }));

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
    createProfile(id, name);
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

app.delete("/api/profile/:id", (c) => {
  const id = c.req.param("id");
  try {
    deleteProfile(id);
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