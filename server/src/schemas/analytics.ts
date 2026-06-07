import { z } from "zod";

export const analyticsEventNames = [
  "extension_installed",
  "first_stash",
  "stash_tab",
  "stash_all_tabs",
  "notion_connected",
  "notion_sync_success",
  "ai_analysis_completed",
  "feedback_submitted"
] as const;

export const analyticsEventSchema = z.object({
  user_id: z.string().uuid(),
  event_name: z.enum(analyticsEventNames),
  metadata: z.record(z.unknown()).optional().default({})
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
