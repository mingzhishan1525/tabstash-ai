import type { StashItem, UserSettings } from "../types";

function escapeYaml(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function dateStamp(value: string) {
  return value.slice(0, 10);
}

export function markdownFileName(item: StashItem) {
  const title = sanitizeFileName(item.title || "Untitled page") || "Untitled page";
  return `${dateStamp(item.createdAt)} - ${title}.md`;
}

export function buildMarkdown(item: StashItem) {
  const tags = item.tags || [];
  const points = item.bulletPoints || [];

  const frontmatter = [
    "---",
    `title: "${escapeYaml(item.title || "Untitled page")}"`,
    `url: "${escapeYaml(item.url)}"`,
    `source: "TabStash AI"`,
    `created: "${item.createdAt}"`,
    tags.length ? `tags: [${tags.map((tag) => `"${escapeYaml(tag)}"`).join(", ")}]` : "tags: []",
    "---"
  ].join("\n");

  const body = [
    `# ${item.title || "Untitled page"}`,
    "",
    "## AI Summary",
    "",
    item.brief || "No summary yet.",
    "",
    "## Key Points",
    "",
    ...(points.length ? points.map((point) => `- ${point}`) : ["- No key points yet."]),
    "",
    "## Original URL",
    "",
    item.url
  ].join("\n");

  return `${frontmatter}\n\n${body}\n`;
}

export async function downloadMarkdown(item: StashItem) {
  const markdown = buildMarkdown(item);
  const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;

  await chrome.downloads.download({
    url,
    filename: `TabStash AI/${markdownFileName(item)}`,
    saveAs: false
  });
}

export async function openInObsidian(item: StashItem, settings: UserSettings) {
  if (!settings.obsidianVaultName?.trim()) {
    throw new Error("Add your Obsidian vault name in Settings first.");
  }

  const fileName = markdownFileName(item).replace(/\.md$/i, "");
  const folder = settings.obsidianFolder?.trim().replace(/^\/+|\/+$/g, "");
  const name = folder ? `${folder}/${fileName}` : fileName;
  const params = new URLSearchParams({
    vault: settings.obsidianVaultName.trim(),
    name,
    content: buildMarkdown(item)
  });

  await chrome.tabs.create({
    url: `obsidian://new?${params.toString()}`,
    active: false
  });
}
