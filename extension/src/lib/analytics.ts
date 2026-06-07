import { getSettings } from "./settings";

export type AnalyticsEventName =
  | "extension_installed"
  | "first_stash"
  | "stash_tab"
  | "stash_all_tabs"
  | "notion_connected"
  | "notion_sync_success"
  | "ai_analysis_completed"
  | "feedback_submitted";

const USER_ID_KEY = "tabstash.analytics.user_id";
const FIRST_STASH_KEY = "tabstash.analytics.first_stash_sent";

async function getOrCreateUserId() {
  const result = await chrome.storage.local.get(USER_ID_KEY);
  const stored = result[USER_ID_KEY] as string | undefined;
  if (stored) return stored;

  const userId = crypto.randomUUID();
  await chrome.storage.local.set({ [USER_ID_KEY]: userId });
  return userId;
}

export async function trackEvent(eventName: AnalyticsEventName, metadata: Record<string, unknown> = {}) {
  try {
    const [settings, userId] = await Promise.all([getSettings(), getOrCreateUserId()]);
    await fetch(`${settings.apiBaseUrl}/api/analytics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: userId,
        event_name: eventName,
        metadata
      })
    });
  } catch {
    // Analytics must never block the stash workflow.
  }
}

export async function trackFirstStash(metadata: Record<string, unknown> = {}) {
  try {
    const result = await chrome.storage.local.get(FIRST_STASH_KEY);
    if (result[FIRST_STASH_KEY]) return;

    await chrome.storage.local.set({ [FIRST_STASH_KEY]: true });
    await trackEvent("first_stash", metadata);
  } catch {
    // Ignore analytics failures.
  }
}
