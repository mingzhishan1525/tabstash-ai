import { Save, X } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "../lib/analytics";
import { validateNotionConnection } from "../lib/api";
import type { UserSettings } from "../types";

type Props = {
  settings: UserSettings;
  onClose: () => void;
  onSave: (settings: UserSettings) => Promise<void>;
};

export function SettingsPanel({ settings, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<UserSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [testingNotion, setTestingNotion] = useState(false);
  const [notionTestMessage, setNotionTestMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    onClose();
  }

  async function handleTestNotion() {
    setTestingNotion(true);
    setNotionTestMessage(null);

    try {
      const result = await validateNotionConnection(draft);
      void trackEvent("notion_connected");
      setNotionTestMessage(result.databaseTitle ? `Connected to ${result.databaseTitle}.` : "Notion connection ready.");
    } catch (error) {
      setNotionTestMessage(error instanceof Error ? error.message : "Notion connection failed.");
    } finally {
      setTestingNotion(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-panel">
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between border-b border-line bg-white px-4 py-4">
          <div>
            <h2 className="text-base font-semibold">Settings</h2>
            <p className="mt-1 text-xs text-muted">Credentials are stored in chrome.storage.sync.</p>
          </div>
          <button aria-label="Close settings" className="rounded-md p-1 hover:bg-panel" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          <label className="block">
            <span className="text-xs font-medium text-muted">API Base URL</span>
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
              value={draft.apiBaseUrl}
              onChange={(event) => setDraft({ ...draft, apiBaseUrl: event.target.value.trim() })}
              placeholder="API server URL"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">Notion Internal Integration Token</span>
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
              type="password"
              value={draft.notionToken || ""}
              onChange={(event) => setDraft({ ...draft, notionToken: event.target.value })}
              placeholder="Notion integration token"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted">Notion Database ID</span>
            <input
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
              value={draft.notionDatabaseId || ""}
              onChange={(event) => setDraft({ ...draft, notionDatabaseId: event.target.value.trim() })}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </label>

          <div className="rounded-lg border border-line bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Notion SDK</h3>
                <p className="mt-1 text-xs text-muted">Validate token access and required database fields.</p>
              </div>
              <button
                className="shrink-0 rounded-md border border-line px-2.5 py-2 text-xs font-medium hover:bg-panel disabled:opacity-50"
                disabled={testingNotion || !draft.notionToken || !draft.notionDatabaseId}
                onClick={handleTestNotion}
              >
                {testingNotion ? "Testing..." : "Test"}
              </button>
            </div>
            {notionTestMessage ? <p className="mt-3 rounded-md bg-panel px-2 py-1.5 text-xs text-muted">{notionTestMessage}</p> : null}
          </div>

          <div className="rounded-lg border border-line bg-white p-3">
            <h3 className="text-sm font-semibold">Obsidian</h3>
            <p className="mt-1 text-xs text-muted">Used by the Obsidian URI export button.</p>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-muted">Vault Name</span>
              <input
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
                value={draft.obsidianVaultName || ""}
                onChange={(event) => setDraft({ ...draft, obsidianVaultName: event.target.value })}
                placeholder="My Knowledge Vault"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-muted">Folder</span>
              <input
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
                value={draft.obsidianFolder || ""}
                onChange={(event) => setDraft({ ...draft, obsidianFolder: event.target.value })}
                placeholder="Inbox/TabStash"
              />
            </label>
          </div>
        </div>

        <footer className="border-t border-line bg-white p-4">
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            disabled={saving}
            onClick={handleSave}
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </footer>
      </div>
    </div>
  );
}
