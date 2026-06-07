import { ChevronDown, ChevronRight, Download, FileInput, FileUp, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import type { StashItem } from "../types";

type Props = {
  item: StashItem;
  selected: boolean;
  onRestore: (item: StashItem) => void;
  onDelete: (item: StashItem) => void;
  onRetryAnalyze: (item: StashItem) => void;
  onSendToNotion: (item: StashItem) => void;
  onDownloadMarkdown: (item: StashItem) => void;
  onOpenInObsidian: (item: StashItem) => void;
  onToggleSelected: (item: StashItem) => void;
};

export function StashCard({
  item,
  selected,
  onRestore,
  onDelete,
  onRetryAnalyze,
  onSendToNotion,
  onDownloadMarkdown,
  onOpenInObsidian,
  onToggleSelected
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const domain = useMemo(() => {
    try {
      return new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      return item.url;
    }
  }, [item.url]);

  const points = item.bulletPoints || [];
  const statusHistory = item.statusHistory || [{ status: item.status, at: item.updatedAt || item.createdAt }];

  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <article className="rounded-lg border border-line bg-white p-3 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <input
            aria-label="Select item"
            checked={selected}
            className="mt-1 h-4 w-4 rounded border-line accent-ink"
            type="checkbox"
            onChange={() => onToggleSelected(item)}
          />
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5">{item.title || "Untitled page"}</h3>
            <p className="mt-1 truncate text-xs text-muted">{domain}</p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <section className="mt-3">
        <div className="text-[11px] font-semibold uppercase text-muted">AI Summary</div>
        <p className="mt-1 text-sm leading-5 text-ink">
          {item.brief || (item.status === "processing" ? "Structuring this page..." : "No summary yet.")}
        </p>
      </section>

      {item.error ? <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{item.error}</p> : null}

      {item.markdownExportedAt || item.obsidianOpenedAt || item.notionSynced ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
          {item.markdownExportedAt ? <span className="rounded-full bg-panel px-2 py-1">Markdown exported</span> : null}
          {item.obsidianOpenedAt ? <span className="rounded-full bg-panel px-2 py-1">Opened in Obsidian</span> : null}
          {item.notionSynced ? <span className="rounded-full bg-panel px-2 py-1">Notion synced</span> : null}
        </div>
      ) : null}

      <section className="mt-3">
        <div className="text-[11px] font-semibold uppercase text-muted">AI Tags</div>
        {item.tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-line bg-panel px-2 py-1 text-[11px] text-muted">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted">{item.status === "processing" ? "Generating tags..." : "No tags yet."}</p>
        )}
      </section>

      {points.length ? (
        <div className="mt-3">
          <button
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Key points
          </button>
          {expanded ? (
            <ul className="mt-2 space-y-1.5 text-sm leading-5 text-ink">
              {points.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <section className="mt-3 rounded-md bg-panel px-3 py-2">
        <div className="text-[11px] font-semibold uppercase text-muted">Status Flow</div>
        <div className="mt-2 space-y-1.5">
          {statusHistory.map((entry, index) => (
            <div key={`${entry.status}-${entry.at}-${index}`} className="flex items-start gap-2 text-xs">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
              <div className="min-w-0">
                <span className="font-medium text-ink">{entry.status}</span>
                <span className="ml-2 text-muted">{formatTime(entry.at)}</span>
                {entry.note ? <p className="mt-0.5 text-muted">{entry.note}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium hover:bg-panel"
          onClick={() => onRestore(item)}
          title="Restore original tab and remove from inbox"
        >
          <RotateCcw size={14} />
          Restore
        </button>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium hover:bg-panel"
          onClick={() => onDownloadMarkdown(item)}
          title="Download Markdown"
        >
          <Download size={14} />
          Markdown
        </button>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium hover:bg-panel disabled:opacity-50"
          disabled={item.status !== "done"}
          onClick={() => onSendToNotion(item)}
          title="Send to Notion"
        >
          <FileUp size={14} />
          Notion
        </button>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium hover:bg-panel disabled:opacity-50"
          disabled={!item.rawText || item.status === "processing"}
          onClick={() => onRetryAnalyze(item)}
          title="Retry AI analysis"
        >
          <RefreshCw size={14} />
          Retry
        </button>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium hover:bg-panel"
          onClick={() => onOpenInObsidian(item)}
          title="Open in Obsidian"
        >
          <FileInput size={14} />
          Obsidian
        </button>
      </div>

      <div className="mt-2 flex justify-end">
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-2 text-xs font-medium text-muted hover:bg-red-50 hover:text-red-700"
          onClick={() => onDelete(item)}
          title="Delete"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      {item.notionSynced ? (
        <a
          className="mt-3 block truncate text-xs text-blue-700 hover:underline"
          href={item.notionPageUrl}
          target="_blank"
          rel="noreferrer"
        >
          Archived in Notion
        </a>
      ) : null}
    </article>
  );
}
