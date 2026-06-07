export type StashStatus = "pending" | "processing" | "done" | "failed";

export type StatusHistoryEntry = {
  status: StashStatus;
  at: string;
  note?: string;
};

export type StashItem = {
  id: string;
  url: string;
  title: string;
  rawText?: string;
  brief?: string;
  tags?: string[];
  bulletPoints?: string[];
  status: StashStatus;
  statusHistory?: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  notionSynced?: boolean;
  notionPageUrl?: string;
  notionSyncedAt?: string;
  obsidianOpenedAt?: string;
  markdownExportedAt?: string;
  error?: string;
};

export type UserSettings = {
  notionToken?: string;
  notionDatabaseId?: string;
  obsidianVaultName?: string;
  obsidianFolder?: string;
  apiBaseUrl: string;
  plan: "free" | "pro";
  monthlyAnalyzeCount: number;
  monthlyAnalyzeReset: string;
};

export type ExtractedPage = {
  title: string;
  url: string;
  excerpt?: string;
  textContent?: string;
};

export type AnalyzeResponse = {
  title: string;
  brief: string;
  tags: string[];
  bulletPoints: string[];
};
