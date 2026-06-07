import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  BarChart3,
  CheckSquare,
  Download,
  FileInput,
  FileUp,
  Inbox,
  Layers,
  Plus,
  Settings,
  Square
} from "lucide-react";
import "./styles.css";
import { trackEvent, trackFirstStash } from "./lib/analytics";
import { analyzePage, createNotionPage } from "./lib/api";
import { closeTab, closeTabs, extractCurrentTab, extractTab, getCurrentWindowTabs, reopenUrl } from "./lib/chromeTabs";
import { deleteItem, getItem, listItems, putItem, updateItem } from "./lib/db";
import { downloadMarkdown, openInObsidian } from "./lib/markdown";
import { getSettings, incrementAnalyzeUsage, saveSettings } from "./lib/settings";
import { SettingsPanel } from "./components/SettingsPanel";
import { StashCard } from "./components/StashCard";
import type { StashItem, StashStatus, UserSettings } from "./types";

const FREE_LIMIT = 50;
type StatusFilter = "all" | StashStatus;
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "pending" },
  { value: "processing", label: "processing" },
  { value: "done", label: "done" },
  { value: "failed", label: "failed" }
];

function makeId() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

function friendlyExtractionMessage(parseFailed: boolean) {
  return parseFailed ? "This page could not be parsed." : undefined;
}

function dateKey(value: string) {
  return new Date(value).toLocaleDateString();
}

function todayKey() {
  return new Date().toLocaleDateString();
}

function createStashItem(tab: chrome.tabs.Tab, result: Awaited<ReturnType<typeof extractTab>>["result"]): StashItem {
  const now = new Date().toISOString();
  const rawText = result.page.textContent?.trim() || "";

  return {
    id: makeId(),
    url: result.page.url || tab.url || "",
    title: result.page.title || tab.title || "Untitled page",
    rawText,
    brief: friendlyExtractionMessage(result.parseFailed),
    tags: [],
    bulletPoints: [],
    status: rawText ? "pending" : "failed",
    statusHistory: [
      {
        status: rawText ? "pending" : "failed",
        at: now,
        note: result.parseFailed ? "Readable content was unavailable." : "Saved locally and queued for AI analysis."
      }
    ],
    createdAt: now,
    updatedAt: now,
    error: result.parseFailed ? "Current page could not be fully read, but its URL was saved." : undefined
  };
}

async function saveItemOrThrow(item: StashItem) {
  await putItem(item);
  const saved = await getItem(item.id);
  if (!saved) throw new Error("Item was not persisted.");
}

function App() {
  const [items, setItems] = useState<StashItem[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const usageText = useMemo(() => {
    if (!settings) return "--/50";
    return `${settings.monthlyAnalyzeCount}/${FREE_LIMIT}`;
  }, [settings]);

  const statusCounts = useMemo(() => {
    return items.reduce(
      (counts, item) => {
        counts.all += 1;
        counts[item.status] += 1;
        return counts;
      },
      { all: 0, pending: 0, processing: 0, done: 0, failed: 0 } satisfies Record<StatusFilter, number>
    );
  }, [items]);
  const visibleItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);
  const selectedVisibleItems = useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)),
    [selectedIds, visibleItems]
  );
  const allVisibleSelected = visibleItems.length > 0 && selectedVisibleItems.length === visibleItems.length;
  const usagePercent = settings ? Math.min(100, (settings.monthlyAnalyzeCount / FREE_LIMIT) * 100) : 0;
  const todayStats = useMemo(() => {
    const key = todayKey();
    const archived = items.filter((item) => dateKey(item.createdAt) === key).length;
    const analyzed = items.filter((item) => item.status === "done" && dateKey(item.updatedAt) === key).length;
    const exported = items.filter(
      (item) =>
        (item.markdownExportedAt && dateKey(item.markdownExportedAt) === key) ||
        (item.obsidianOpenedAt && dateKey(item.obsidianOpenedAt) === key) ||
        (item.notionSyncedAt && dateKey(item.notionSyncedAt) === key)
    ).length;

    return { archived, analyzed, exported };
  }, [items]);
  const recentActivity = useMemo(() => items.slice(0, 3), [items]);
  const notionConfigured = Boolean(settings?.notionToken && settings.notionDatabaseId);
  const notionStats = useMemo(() => {
    const synced = items.filter((item) => item.notionSynced).length;
    const ready = items.filter((item) => item.status === "done" && !item.notionSynced).length;
    return { synced, ready };
  }, [items]);

  async function refresh() {
    const [nextItems, nextSettings] = await Promise.all([listItems(), getSettings()]);
    setItems(nextItems);
    setSettings(nextSettings);
    setSelectedIds((current) => {
      const validIds = new Set(nextItems.map((item) => item.id));
      return new Set([...current].filter((id) => validIds.has(id)));
    });
  }

  useEffect(() => {
    refresh()
      .catch(() => setNotice("Could not load local inbox. Try reopening the side panel."))
      .finally(() => setLoading(false));
  }, []);

  async function syncItemToNotion(item: StashItem, currentSettings: UserSettings) {
    if (!currentSettings.notionToken || !currentSettings.notionDatabaseId) return;
    if (item.status !== "done" || item.notionSynced) return;

    try {
      const result = await createNotionPage(currentSettings, item);
      await updateItem(item.id, {
        notionSynced: true,
        notionPageUrl: result.notionPageUrl,
        notionSyncedAt: new Date().toISOString(),
        error: undefined
      });
      void trackEvent("notion_sync_success", { item_id: item.id, mode: "auto" });
      setNotice("AI summary saved and synced to Notion.");
    } catch (error) {
      await updateItem(item.id, {
        error: error instanceof Error ? error.message : "Notion sync failed. The AI summary is saved in your inbox."
      });
      setNotice("AI summary saved. Notion sync failed.");
    } finally {
      await refresh();
    }
  }

  async function runAnalyze(item: StashItem, currentSettings: UserSettings, canAnalyze: boolean, autoSyncNotion = true) {
    if (!canAnalyze || !item.rawText) {
      await updateItem(item.id, {
        status: item.rawText ? "pending" : "failed",
        brief: item.brief || "This page could not be parsed.",
        error: item.rawText ? "Monthly free AI parsing limit reached." : undefined
      });
      await refresh();
      return;
    }

    await updateItem(item.id, { status: "processing", error: undefined });
    await refresh();

    try {
      const analysis = await analyzePage(currentSettings, item);
      const analyzedItem = await updateItem(item.id, {
        ...analysis,
        status: "done",
        error: undefined
      });
      void trackEvent("ai_analysis_completed", {
        item_id: item.id,
        tag_count: analysis.tags.length,
        bullet_count: analysis.bulletPoints.length
      });
      const updatedSettings = await incrementAnalyzeUsage();
      setSettings(updatedSettings);
      await refresh();

      if (autoSyncNotion && analyzedItem) {
        await syncItemToNotion(analyzedItem, {
          ...currentSettings,
          monthlyAnalyzeCount: updatedSettings.monthlyAnalyzeCount
        });
        return;
      }
    } catch (error) {
      await updateItem(item.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "AI analysis failed. The item is saved locally."
      });
    }

    await refresh();
  }

  async function handleStashCurrentTab() {
    if (busy || !settings) return;

    setBusy(true);
    setNotice(null);

    try {
      const { tab, result } = await extractCurrentTab();
      const item = createStashItem(tab, result);

      await saveItemOrThrow(item);
      void trackFirstStash({ source: "stash_tab" });
      void trackEvent("stash_tab", { item_id: item.id, parse_failed: result.parseFailed });
      await refresh();
      try {
        await closeTab(tab.id);
      } catch {
        setNotice("Saved, but Chrome could not close the original tab.");
      }

      const canAnalyze = settings.plan === "pro" || settings.monthlyAnalyzeCount < FREE_LIMIT;
      void runAnalyze(item, settings, canAnalyze, true);
    } catch {
      setNotice("This tab could not be stashed. Chrome pages and restricted pages may block access.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStashAllTabs() {
    if (busy || !settings) return;

    setBusy(true);
    setNotice(null);

    try {
      const tabs = (await getCurrentWindowTabs()).filter((tab) => tab.id && tab.url);
      if (!tabs.length) {
        setNotice("No tabs available to stash.");
        return;
      }

      const createdItems: StashItem[] = [];
      const closableIds: number[] = [];

      for (const tab of tabs) {
        try {
          const { result } = await extractTab(tab);
          const item = createStashItem(tab, result);
          await saveItemOrThrow(item);
          createdItems.push(item);
          if (tab.id) closableIds.push(tab.id);
        } catch {
          const fallbackResult = {
            page: {
              title: tab.title || "Untitled page",
              url: tab.url || "",
              textContent: "",
              excerpt: ""
            },
            parseFailed: true
          };
          const item = createStashItem(tab, fallbackResult);
          await saveItemOrThrow(item);
          createdItems.push(item);
          if (tab.id) closableIds.push(tab.id);
        }
      }

      await refresh();
      if (createdItems.length) {
        void trackFirstStash({ source: "stash_all_tabs" });
        void trackEvent("stash_all_tabs", { tab_count: createdItems.length });
      }
      let closedTabs = true;
      try {
        await closeTabs(closableIds);
      } catch {
        closedTabs = false;
      }

      for (const item of createdItems) {
        const canAnalyze = settings.plan === "pro" || settings.monthlyAnalyzeCount < FREE_LIMIT;
        void runAnalyze(item, settings, canAnalyze, true);
      }

      setNotice(closedTabs ? `Stashed and closed ${createdItems.length} tabs.` : `Saved ${createdItems.length} tabs, but Chrome could not close all of them.`);
    } catch {
      setNotice("Tabs could not be stashed. Some browser pages may block access.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: StashItem) {
    await deleteItem(item.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    await refresh();
  }

  async function handleRestore(item: StashItem) {
    setNotice(null);

    try {
      await reopenUrl(item.url);
      await deleteItem(item.id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      setNotice("Tab restored and removed from inbox.");
      await refresh();
    } catch {
      setNotice("Could not restore this tab. The saved item is still in your inbox.");
    }
  }

  async function handleRetryAnalyze(item: StashItem) {
    if (!settings) return;

    const canAnalyze = settings.plan === "pro" || settings.monthlyAnalyzeCount < FREE_LIMIT;
    if (!canAnalyze) {
      await updateItem(item.id, {
        status: "pending",
        error: "Monthly free AI parsing limit reached."
      });
      setNotice("Monthly free AI parsing limit reached.");
      await refresh();
      return;
    }

    void runAnalyze(item, settings, canAnalyze, true);
  }

  async function handleSendToNotion(item: StashItem) {
    if (!settings) return;

    if (item.status !== "done") {
      setNotice("AI analysis must finish before sending this item to Notion.");
      return;
    }

    if (!settings.notionToken || !settings.notionDatabaseId) {
      setNotice("Add your Notion token and database ID in Settings first.");
      setShowSettings(true);
      return;
    }

    setNotice(null);
    await updateItem(item.id, { error: undefined });
    await refresh();

    try {
      const result = await createNotionPage(settings, item);
      await updateItem(item.id, {
        notionSynced: true,
        notionPageUrl: result.notionPageUrl,
        notionSyncedAt: new Date().toISOString()
      });
      void trackEvent("notion_sync_success", { item_id: item.id, mode: "manual" });
      setNotice("Sent to Notion with Notion SDK.");
    } catch (error) {
      await updateItem(item.id, {
        error: error instanceof Error ? error.message : "Notion archive failed. Check settings and try again."
      });
      setNotice("Notion archive failed.");
    } finally {
      await refresh();
    }
  }

  async function handleDownloadMarkdown(item: StashItem) {
    setNotice(null);

    try {
      await downloadMarkdown(item);
      await updateItem(item.id, { markdownExportedAt: new Date().toISOString() });
      setNotice("Markdown exported.");
      await refresh();
    } catch {
      setNotice("Markdown export failed. Check Chrome download permissions and try again.");
    }
  }

  async function handleOpenInObsidian(item: StashItem) {
    if (!settings) return;
    setNotice(null);

    try {
      await openInObsidian(item, settings);
      await updateItem(item.id, { obsidianOpenedAt: new Date().toISOString() });
      setNotice("Sent to Obsidian.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Obsidian export failed. Check Settings and try again.");
      setShowSettings(true);
    }
  }

  function toggleSelected(item: StashItem) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (visibleItems.length > 0 && visibleItems.every((item) => next.has(item.id))) {
        visibleItems.forEach((item) => next.delete(item.id));
        return next;
      }

      visibleItems.forEach((item) => next.add(item.id));
      return next;
    });
  }

  async function handleBatchMarkdown() {
    if (!selectedItems.length) return;
    setNotice(null);

    let exported = 0;
    for (const item of selectedItems) {
      try {
        await downloadMarkdown(item);
        await updateItem(item.id, { markdownExportedAt: new Date().toISOString() });
        exported += 1;
      } catch {
        await updateItem(item.id, { error: "Markdown export failed. Try this item again." });
      }
    }

    setNotice(`Exported ${exported}/${selectedItems.length} Markdown files.`);
    await refresh();
  }

  async function handleBatchObsidian() {
    if (!settings || !selectedItems.length) return;
    setNotice(null);

    if (!settings.obsidianVaultName?.trim()) {
      setNotice("Add your Obsidian vault name in Settings first.");
      setShowSettings(true);
      return;
    }

    let opened = 0;
    for (const item of selectedItems) {
      try {
        await openInObsidian(item, settings);
        await updateItem(item.id, { obsidianOpenedAt: new Date().toISOString() });
        opened += 1;
      } catch {
        await updateItem(item.id, { error: "Obsidian export failed. Try this item again." });
      }
    }

    setNotice(`Sent ${opened}/${selectedItems.length} items to Obsidian.`);
    await refresh();
  }

  async function handleBatchNotion() {
    if (!settings || !selectedItems.length) return;

    if (!settings.notionToken || !settings.notionDatabaseId) {
      setNotice("Add your Notion token and database ID in Settings first.");
      setShowSettings(true);
      return;
    }

    const readyItems = selectedItems.filter((item) => item.status === "done");
    if (!readyItems.length) {
      setNotice("Select at least one analyzed item before batch sending to Notion.");
      return;
    }

    let synced = 0;
    for (const item of readyItems) {
      try {
        const result = await createNotionPage(settings, item);
        await updateItem(item.id, {
          notionSynced: true,
          notionPageUrl: result.notionPageUrl,
          notionSyncedAt: new Date().toISOString(),
          error: undefined
        });
        void trackEvent("notion_sync_success", { item_id: item.id, mode: "batch" });
        synced += 1;
      } catch (error) {
        await updateItem(item.id, {
          error: error instanceof Error ? error.message : "Notion archive failed. Try this item again."
        });
      }
    }

    setNotice(`Sent ${synced}/${readyItems.length} analyzed items to Notion.`);
    await refresh();
  }

  async function handleSyncReadyToNotion() {
    if (!settings) return;

    if (!settings.notionToken || !settings.notionDatabaseId) {
      setNotice("Add your Notion token and database ID in Settings first.");
      setShowSettings(true);
      return;
    }

    const readyItems = items.filter((item) => item.status === "done" && !item.notionSynced);
    if (!readyItems.length) {
      setNotice("No analyzed items are waiting for Notion sync.");
      return;
    }

    let synced = 0;
    for (const item of readyItems) {
      try {
        const result = await createNotionPage(settings, item);
        await updateItem(item.id, {
          notionSynced: true,
          notionPageUrl: result.notionPageUrl,
          notionSyncedAt: new Date().toISOString(),
          error: undefined
        });
        void trackEvent("notion_sync_success", { item_id: item.id, mode: "sync_ready" });
        synced += 1;
      } catch (error) {
        await updateItem(item.id, {
          error: error instanceof Error ? error.message : "Notion archive failed. Try this item again."
        });
      }
    }

    setNotice(`Synced ${synced}/${readyItems.length} ready items to Notion.`);
    await refresh();
  }

  async function handleSaveSettings(nextSettings: UserSettings) {
    const saved = await saveSettings(nextSettings);
    setSettings(saved);
  }

  return (
    <main className="flex min-h-screen flex-col bg-panel">
      <header className="border-b border-line bg-white px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-white">
            <Archive size={17} />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-5">TabStash AI</h1>
            <p className="text-xs text-muted">Close tabs without losing ideas.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-3 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            disabled={busy || loading}
            onClick={handleStashCurrentTab}
          >
            <Plus size={16} />
            {busy ? "Stashing..." : "Stash Tab"}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-3 py-2.5 text-sm font-medium hover:bg-panel disabled:opacity-60"
            disabled={busy || loading}
            onClick={handleStashAllTabs}
          >
            <Layers size={16} />
            All Tabs
          </button>
        </div>
      </header>

      {notice ? <div className="mx-4 mt-3 rounded-md border border-line bg-white px-3 py-2 text-sm text-muted">{notice}</div> : null}

      <section className="flex-1 overflow-auto px-4 py-3">
        <div className="mb-3 rounded-lg border border-line bg-white p-3 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <BarChart3 size={16} />
              Free Plan Usage
            </div>
            <span className="text-xs font-medium text-muted">{usageText}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel">
            <div className="h-full rounded-full bg-ink" style={{ width: `${usagePercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">AI analyses included this month.</p>
        </div>

        <div className="mb-3 rounded-lg border border-line bg-white p-3 shadow-soft">
          <div className="mb-3 text-sm font-semibold">Today's Cleanup Statistics</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-panel px-2 py-2">
              <div className="text-base font-semibold">{todayStats.archived}</div>
              <div className="text-[11px] text-muted">Archived</div>
            </div>
            <div className="rounded-md bg-panel px-2 py-2">
              <div className="text-base font-semibold">{todayStats.analyzed}</div>
              <div className="text-[11px] text-muted">Analyzed</div>
            </div>
            <div className="rounded-md bg-panel px-2 py-2">
              <div className="text-base font-semibold">{todayStats.exported}</div>
              <div className="text-[11px] text-muted">Exported</div>
            </div>
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-line bg-white p-3 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold">
                <FileUp size={16} />
                Notion Sync
              </div>
              <p className="mt-1 text-xs text-muted">{notionConfigured ? "Connected with manual integration." : "Not configured yet."}</p>
            </div>
            <span
              className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                notionConfigured
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-line bg-panel text-muted"
              }`}
            >
              {notionConfigured ? "Ready" : "Setup"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md bg-panel px-2 py-2">
              <div className="text-base font-semibold">{notionStats.synced}</div>
              <div className="text-[11px] text-muted">Synced</div>
            </div>
            <div className="rounded-md bg-panel px-2 py-2">
              <div className="text-base font-semibold">{notionStats.ready}</div>
              <div className="text-[11px] text-muted">Ready</div>
            </div>
          </div>
          <button
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-medium hover:bg-panel disabled:opacity-50"
            disabled={notionConfigured && notionStats.ready === 0}
            onClick={notionConfigured ? handleSyncReadyToNotion : () => setShowSettings(true)}
          >
            <FileUp size={14} />
            {notionConfigured ? "Sync Ready Items" : "Configure Notion"}
          </button>
        </div>

        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-medium">
            <Inbox size={16} />
              AI Inbox ({items.length})
            </div>
            <p className="mt-1 text-xs text-muted">Save now.</p>
            <p className="text-xs text-muted">Organize later.</p>
          </div>
        </div>

        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={`shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-medium ${
                statusFilter === filter.value
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-muted hover:bg-panel hover:text-ink"
              }`}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label} ({statusCounts[filter.value]})
            </button>
          ))}
        </div>

        {visibleItems.length ? (
          <div className="mb-3 rounded-lg border border-line bg-white p-2 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-panel"
                onClick={toggleAllVisible}
              >
                {allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                {selectedVisibleItems.length ? `${selectedVisibleItems.length} selected` : "Select visible"}
              </button>
              <button
                className="rounded-md px-2 py-1.5 text-xs text-muted hover:bg-panel hover:text-ink"
                disabled={!selectedVisibleItems.length}
                onClick={() =>
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    visibleItems.forEach((item) => next.delete(item.id));
                    return next;
                  })
                }
              >
                Clear
              </button>
            </div>
            {selectedVisibleItems.length ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium hover:bg-panel"
                  onClick={handleBatchMarkdown}
                >
                  <Download size={14} />
                  Markdown
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium hover:bg-panel"
                  onClick={handleBatchObsidian}
                >
                  <FileInput size={14} />
                  Obsidian
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium hover:bg-panel"
                  onClick={handleBatchNotion}
                >
                  <FileUp size={14} />
                  Notion
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-line bg-white p-5 text-sm text-muted">Loading inbox...</div>
        ) : visibleItems.length ? (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <StashCard
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onDelete={handleDelete}
                onDownloadMarkdown={handleDownloadMarkdown}
                onOpenInObsidian={handleOpenInObsidian}
                onRestore={handleRestore}
                onRetryAnalyze={handleRetryAnalyze}
                onSendToNotion={handleSendToNotion}
                onToggleSelected={toggleSelected}
              />
            ))}
          </div>
        ) : items.length ? (
          <div className="rounded-lg border border-line bg-white p-5 text-sm text-muted shadow-soft">
            No items in this status.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-white p-6 text-center shadow-soft">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-panel">
              <Inbox size={18} />
            </div>
              <h2 className="mt-3 text-sm font-semibold">Turn browser chaos into organized knowledge.</h2>
              <p className="mt-2 text-sm leading-5 text-muted">Stash tabs and let AI extract:</p>
              <ul className="mt-3 space-y-1 text-left text-sm text-muted">
                <li>• Key ideas</li>
                <li>• Tags</li>
                <li>• Actionable insights</li>
              </ul>
            </div>
            <div className="rounded-lg border border-dashed border-line bg-white p-3 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Example: Designing Calm Productivity Tools</h3>
                  <p className="mt-1 text-xs text-muted">linear.app</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                  Demo
                </span>
              </div>
              <p className="mt-3 text-sm leading-5 text-ink">
                A lightweight reference about reducing context overload while preserving useful ideas.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Productivity", "Knowledge", "Design"].map((tag) => (
                  <span key={tag} className="rounded-full border border-line bg-panel px-2 py-1 text-[11px] text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-line bg-white p-3 shadow-soft">
          <h2 className="text-sm font-semibold">Recent Activity</h2>
          {recentActivity.length ? (
            <div className="mt-3 space-y-2">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-ink">{item.title || "Untitled page"}</span>
                  <span className="shrink-0 text-muted">{item.status === "done" ? "Analyzed" : "Archived"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No tabs archived yet.</p>
          )}
        </div>
      </section>

      <footer className="border-t border-line bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-2 text-xs font-medium hover:bg-panel"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={14} />
            Settings
          </button>
          <span className="text-xs text-muted">{items.length} in inbox</span>
        </div>
      </footer>

      {showSettings && settings ? (
        <SettingsPanel settings={settings} onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
