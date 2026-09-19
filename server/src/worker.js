import { createApp } from "./app.js";
import { makeD1Data } from "./data-d1.js";
import { createAi } from "./ai.js";

export default {
  async fetch(request, env, ctx) {
    const origins = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const app = createApp({
      data: makeD1Data(env.DB),
      ai: createAi({
        apiKey: env.GROQ_API_KEY,
        model: env.GROQ_MODEL,
        baseUrl: env.AI_PROXY_URL || undefined,
        proxyToken: env.AI_PROXY_TOKEN || "",
      }),
      allowedOrigins: origins.length ? origins : undefined,
    });
    return app.fetch(request, env, ctx);
  },
};
