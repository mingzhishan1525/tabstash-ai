import { trackEvent } from "./lib/analytics";

chrome.runtime.onInstalled.addListener((details) => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  if (details.reason === "install") {
    void trackEvent("extension_installed");
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.windowId) return;

  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch {
    await chrome.sidePanel.setOptions({
      path: "sidepanel.html",
      enabled: true
    });
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
