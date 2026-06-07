import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { analyzeRequestSchema } from "../schemas/analyze.js";
import { analyzePage } from "../services/ai.js";

export const analyzeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/analyze", async (request, reply) => {
    try {
      const input = analyzeRequestSchema.parse(request.body);
      const result = await analyzePage({
        ...input,
        content: input.content.slice(0, 5000)
      });
      return reply.send(result);
    } catch (error) {
      const message =
        error instanceof ZodError
          ? "Invalid analyze request."
          : error instanceof Error
            ? error.message
            : "AI analysis failed.";
      return reply.code(400).send({ error: message });
    }
  });
};
