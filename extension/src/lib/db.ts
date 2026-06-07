import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { StashItem, StashStatus } from "../types";

interface TabStashDb extends DBSchema {
  items: {
    key: string;
    value: StashItem;
    indexes: {
      "by-createdAt": string;
      "by-status": string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<TabStashDb>> | undefined;

function statusNote(status: StashStatus, error?: string) {
  if (error) return error;
  if (status === "pending") return "Queued for AI analysis.";
  if (status === "processing") return "AI is extracting summary, tags, and key points.";
  if (status === "done") return "AI summary and tags are ready.";
  return "AI analysis failed.";
}

function getDb() {
  dbPromise ??= openDB<TabStashDb>("tabstash-ai", 1, {
    upgrade(db) {
      const store = db.createObjectStore("items", { keyPath: "id" });
      store.createIndex("by-createdAt", "createdAt");
      store.createIndex("by-status", "status");
    }
  });

  return dbPromise;
}

export async function listItems(): Promise<StashItem[]> {
  const db = await getDb();
  const items = await db.getAll("items");
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function putItem(item: StashItem): Promise<void> {
  const db = await getDb();
  await db.put("items", item);
}

export async function getItem(id: string): Promise<StashItem | undefined> {
  const db = await getDb();
  return db.get("items", id);
}

export async function updateItem(id: string, patch: Partial<StashItem>): Promise<StashItem | undefined> {
  const db = await getDb();
  const existing = await db.get("items", id);
  if (!existing) return undefined;

  const updatedAt = new Date().toISOString();
  const statusHistory =
    patch.status && patch.status !== existing.status
      ? [
          ...(existing.statusHistory || [{ status: existing.status, at: existing.createdAt }]),
          {
            status: patch.status,
            at: updatedAt,
            note: statusNote(patch.status, patch.error)
          }
        ]
      : patch.statusHistory || existing.statusHistory;

  const updated = {
    ...existing,
    ...patch,
    statusHistory,
    updatedAt
  };
  await db.put("items", updated);
  return updated;
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("items", id);
}
