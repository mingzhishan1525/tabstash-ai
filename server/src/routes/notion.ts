import type { FastifyPluginAsync } from "fastify";
import { APIResponseError } from "@notionhq/client";
import { ZodError } from "zod";
import { notionCreateRequestSchema, notionValidateRequestSchema } from "../schemas/notion.js";
import { createNotionPage, validateNotionDatabase } from "../services/notion.js";

function notionFriendlyError(error: unknown) {
  if (error instanceof APIResponseError) {
    if (error.code === "unauthorized") return "Notion token is invalid or missing database access.";
    if (error.code === "object_not_found") return "Notion database was not found or is not shared with the integration.";
    if (error.code === "validation_error") return "Notion database fields do not match the TabStash AI template.";
  }

  return "Notion archive failed. Check your token, database ID, and database fields.";
}

export const notionRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/notion/create", async (request, reply) => {
    try {
      const input = notionCreateRequestSchema.parse(request.body);
      const result = await createNotionPage(input);
      return reply.send(result);
    } catch (error) {
      const message = error instanceof ZodError ? "Invalid Notion archive request." : notionFriendlyError(error);
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/api/notion/validate", async (request, reply) => {
    try {
      const input = notionValidateRequestSchema.parse(request.body);
      const result = await validateNotionDatabase(input);
      return reply.send(result);
    } catch (error) {
      const message =
        error instanceof ZodError
          ? "Invalid Notion connection request."
          : error instanceof Error && error.message.includes("TabStash AI template")
            ? error.message
            : notionFriendlyError(error);
      return reply.code(400).send({ error: message });
    }
  });
};
