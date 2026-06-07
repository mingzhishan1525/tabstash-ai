import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { analyticsEventSchema } from "../schemas/analytics.js";
import { getAnalyticsSummary, recordAnalyticsEvent } from "../services/analytics.js";

function analyticsFriendlyError(error: unknown) {
  if (error instanceof ZodError) return "Invalid analytics event.";
  if (error instanceof Error && error.message.includes("PostgreSQL")) return "Analytics database is not configured.";
  return "Analytics request failed.";
}

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/analytics", async (request, reply) => {
    try {
      const input = analyticsEventSchema.parse(request.body);
      const result = await recordAnalyticsEvent(input);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: analyticsFriendlyError(error) });
    }
  });

  app.get("/api/analytics/summary", async (_request, reply) => {
    try {
      const result = await getAnalyticsSummary();
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: analyticsFriendlyError(error) });
    }
  });
};
