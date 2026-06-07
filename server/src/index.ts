import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { analyzeRoutes } from "./routes/analyze.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { notionRoutes } from "./routes/notion.js";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"]
});

app.get("/health", async () => ({ ok: true }));
await app.register(analyzeRoutes);
await app.register(analyticsRoutes);
await app.register(notionRoutes);

const port = Number(process.env.PORT || 8787);

try {
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`TabStash API listening on 0.0.0.0:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
