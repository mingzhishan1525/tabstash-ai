import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

async function readPrivacyHtml() {
  const candidates = [
    path.resolve(process.cwd(), "public/privacy.html"),
    path.resolve(process.cwd(), "server/public/privacy.html"),
    path.resolve(currentDir, "../../public/privacy.html")
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      // Try the next deployment layout.
    }
  }

  throw new Error("Privacy policy page was not found.");
}

export const privacyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/privacy.html", async (_request, reply) => {
    const html = await readPrivacyHtml();
    return reply.type("text/html; charset=utf-8").send(html);
  });
};
