import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", "dist", ".playwright-mcp"]);
const ignoredFiles = new Set(["server/.env", "tabstash-ai-chrome.zip"]);
const allowedEnvExampleAssignments = new Map([
  ["AI_PROVIDER", "deepseek"],
  ["DEEPSEEK_API_KEY", "your-deepseek-api-key"],
  ["DEEPSEEK_MODEL", "deepseek-chat"],
  ["DATABASE_URL", "postgres://user:password@host:5432/db"]
]);

const tokenPatterns = [
  { label: "API key prefix", pattern: /sk-[A-Za-z0-9_-]{8,}/ },
  { label: "Notion legacy token prefix", pattern: /secret_[A-Za-z0-9_-]{8,}/ },
  { label: "Notion token prefix", pattern: /ntn_[A-Za-z0-9_-]{8,}/ }
];

const envAssignmentPattern = /\b(DEEPSEEK_API_KEY|NOTION_TOKEN|NOTION_DATABASE_ID)=([^\s"'`]+)/g;

async function listFiles(directory) {
  const entries = await readdir(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const relativePath = path.relative(root, fullPath);
    const info = await stat(fullPath);

    if (info.isDirectory()) {
      if (!ignoredDirectories.has(entry) && !relativePath.endsWith("/dist")) {
        files.push(...(await listFiles(fullPath)));
      }
      continue;
    }

    if (!ignoredFiles.has(relativePath)) files.push(fullPath);
  }

  return files;
}

async function readText(file) {
  const buffer = await readFile(file);
  if (buffer.includes(0)) return "";
  return buffer.toString("utf8");
}

function isAllowedEnvExample(relativePath, key, value) {
  return relativePath === "server/.env.example" && allowedEnvExampleAssignments.get(key) === value;
}

function isSafePlaceholder(value) {
  return value === "..." || value.startsWith("your-") || value.includes("<");
}

async function main() {
  const findings = [];
  const files = await listFiles(root);

  for (const file of files) {
    const relativePath = path.relative(root, file);
    const content = await readText(file).catch(() => "");
    if (!content) continue;

    for (const blocked of tokenPatterns) {
      if (blocked.pattern.test(content)) {
        findings.push(`${relativePath}: ${blocked.label}`);
      }
    }

    for (const match of content.matchAll(envAssignmentPattern)) {
      const [, key, value] = match;
      if (!isAllowedEnvExample(relativePath, key, value) && !isSafePlaceholder(value)) {
        findings.push(`${relativePath}: ${key}= assignment is not allowed outside server/.env.example`);
      }
    }
  }

  if (findings.length) {
    console.error("Secret scan failed:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exit(1);
  }

  console.log("Secret scan passed.");
}

await main();
