import { z } from "zod";

export const analyzeRequestSchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().url(),
  content: z.string().max(5000).default("")
});

export const analyzeResultSchema = z.object({
  title: z.string().min(1).max(300),
  brief: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(40)).min(1).max(8),
  bulletPoints: z.array(z.string().min(1).max(240)).min(1).max(5)
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalyzeResult = z.infer<typeof analyzeResultSchema>;
