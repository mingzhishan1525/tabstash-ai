import type { AnalyzeResponse, StashItem, UserSettings } from "../types";

function friendlyError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "Network request failed. Check that the TabStash API server is running.";
  }

  if (normalized.includes("abort") || normalized.includes("timeout")) {
    return "Request timed out. The item is saved locally and can be retried.";
  }

  if (normalized.includes("notion")) {
    return "Notion could not archive this item. Check your token, database ID, and template fields.";
  }

  if (normalized.includes("ai") || normalized.includes("json")) {
    return "AI analysis failed. The item is saved and you can retry later.";
  }

  return "Something went wrong. The item is still saved locally.";
}

async function postJson<T>(apiBaseUrl: string, path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    throw new Error(friendlyError(error instanceof Error ? error.message : "Network request failed."));
  } finally {
    window.clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(friendlyError(String(payload.error || response.statusText)));
  }

  return payload as T;
}

export async function analyzePage(settings: UserSettings, item: StashItem): Promise<AnalyzeResponse> {
  return postJson<AnalyzeResponse>(settings.apiBaseUrl, "/api/analyze", {
    title: item.title,
    url: item.url,
    content: (item.rawText || "").slice(0, 5000)
  }, 22000);
}

export async function createNotionPage(settings: UserSettings, item: StashItem) {
  if (!item.brief || !item.tags?.length || !item.bulletPoints?.length) {
    throw new Error("Run AI analysis before sending this item to Notion.");
  }

  return postJson<{ success: true; notionPageUrl: string }>(
    settings.apiBaseUrl,
    "/api/notion/create",
    {
      notionToken: settings.notionToken,
      databaseId: settings.notionDatabaseId,
      item: {
        title: item.title,
        url: item.url,
        brief: item.brief,
        tags: item.tags || [],
        bulletPoints: item.bulletPoints || []
      }
    },
    8000
  );
}

export async function validateNotionConnection(settings: UserSettings) {
  return postJson<{ success: true; databaseTitle: string }>(settings.apiBaseUrl, "/api/notion/validate", {
    notionToken: settings.notionToken,
    databaseId: settings.notionDatabaseId
  });
}
