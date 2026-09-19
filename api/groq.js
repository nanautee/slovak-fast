const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const expected = process.env.AI_PROXY_TOKEN || "";
  const token = req.headers["x-proxy-token"] || "";
  if (!expected || token !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const body = req.body || {};
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages required" });
    return;
  }
  const payload = {
    model: body.model || "openai/gpt-oss-20b",
    temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
    messages,
  };
  if (body.max_tokens) payload.max_tokens = body.max_tokens;
  if (body.response_format) payload.response_format = body.response_format;
  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY || ""}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
