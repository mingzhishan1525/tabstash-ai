import type { UserSettings } from "../types";

const SETTINGS_KEY = "tabstash.settings";
declare const __API_BASE_URL__: string;

const DEFAULT_API_URL = __API_BASE_URL__;

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export const defaultSettings: UserSettings = {
  apiBaseUrl: DEFAULT_API_URL,
  plan: "free",
  monthlyAnalyzeCount: 0,
  monthlyAnalyzeReset: currentMonthKey()
};

export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<UserSettings> | undefined;
  const merged = { ...defaultSettings, ...stored };

  if (merged.monthlyAnalyzeReset !== currentMonthKey()) {
    return saveSettings({
      ...merged,
      monthlyAnalyzeCount: 0,
      monthlyAnalyzeReset: currentMonthKey()
    });
  }

  return merged;
}

export async function saveSettings(settings: UserSettings): Promise<UserSettings> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
  return settings;
}

export async function incrementAnalyzeUsage(): Promise<UserSettings> {
  const settings = await getSettings();
  const next = {
    ...settings,
    monthlyAnalyzeCount: settings.monthlyAnalyzeCount + 1
  };
  return saveSettings(next);
}
