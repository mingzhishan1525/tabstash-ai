import { z } from "zod";
import { analyzeResultSchema } from "./analyze.js";

export const notionCreateRequestSchema = z.object({
  notionToken: z.string().min(1),
  databaseId: z.string().min(1),
  item: analyzeResultSchema.extend({
    url: z.string().url()
  })
});

export const notionValidateRequestSchema = z.object({
  notionToken: z.string().min(1),
  databaseId: z.string().min(1)
});

export type NotionCreateRequest = z.infer<typeof notionCreateRequestSchema>;
export type NotionValidateRequest = z.infer<typeof notionValidateRequestSchema>;
