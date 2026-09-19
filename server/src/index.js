import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import * as data from "./data.js";
import { createAi } from "./ai.js";

const PORT = Number(process.env.PORT) || 8787;
const origins = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

const app = createApp({
  data,
  ai: createAi({ apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL }),
  allowedOrigins: origins.length ? origins : undefined,
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`SlovakFast API on http://localhost:${info.port}`);
});
