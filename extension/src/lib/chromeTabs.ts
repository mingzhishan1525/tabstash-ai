import type { ExtractedPage } from "../types";

type ExtractionResult = {
  page: ExtractedPage;
  parseFailed: boolean;
};

function isInjectableUrl(url?: string) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

export async function getCurrentActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function getCurrentWindowTabs() {
  return chrome.tabs.query({ currentWindow: true });
}

export async function extractTab(tab: chrome.tabs.Tab): Promise<{ tab: chrome.tabs.Tab; result: ExtractionResult }> {
  if (!tab?.id) throw new Error("No tab is available.");
  const fallback: ExtractedPage = {
    title: tab.title || "Untitled page",
    url: tab.url || "",
    textContent: "",
    excerpt: ""
  };

  if (!isInjectableUrl(tab.url)) {
    return { tab, result: { page: fallback, parseFailed: true } };
  }

  try {
    let response: { ok?: boolean; page?: ExtractedPage } | undefined;

    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "TABSTASH_EXTRACT_PAGE"
      });
    } catch {
      const contentScript = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
      if (contentScript) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [contentScript]
        });
        response = await chrome.tabs.sendMessage(tab.id, {
          type: "TABSTASH_EXTRACT_PAGE"
        });
      }
    }

    if (!response?.ok || !response.page?.textContent) {
      return { tab, result: { page: { ...fallback, ...response?.page }, parseFailed: true } };
    }

    return { tab, result: { page: response.page as ExtractedPage, parseFailed: false } };
  } catch {
    return { tab, result: { page: fallback, parseFailed: true } };
  }
}

export async function extractCurrentTab(): Promise<{ tab: chrome.tabs.Tab; result: ExtractionResult }> {
  const tab = await getCurrentActiveTab();
  if (!tab?.id) throw new Error("No active tab is available.");
  return extractTab(tab);
}

export async function closeTab(tabId?: number) {
  if (!tabId) return;
  await chrome.tabs.remove(tabId);
}

export async function closeTabs(tabIds: number[]) {
  if (!tabIds.length) return;
  await chrome.tabs.remove(tabIds);
}

export async function reopenUrl(url: string) {
  return chrome.tabs.create({ url, active: true });
}
