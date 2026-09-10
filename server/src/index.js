import { serve } from "@hono/node-server";
import { app } from "./app.js";

const PORT = Number(process.env.PORT) || 8787;

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`SlovakFast API on http://localhost:${info.port}`);
});