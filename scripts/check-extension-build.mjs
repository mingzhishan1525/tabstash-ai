import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd().endsWith(`${path.sep}extension`) ? process.cwd() : path.join(process.cwd(), "extension");
const distDir = path.join(root, "dist");

const blockedPatterns = [
  { label: "DeepSeek/OpenAI-style API key prefix", pattern: /sk-/ },
  { label: "Notion legacy secret prefix", pattern: /secret_/ },
  { label: "Notion token prefix", pattern: /ntn_/ },
  { label: "localhost URL", pattern: /localhost/i }
];

async function listFiles(directory) {
  const entries = await readdir(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const files = await listFiles(distDir);
  const findings = [];

  for (const file of files) {
    const content = await readFile(file, "utf8").catch(() => "");
    for (const blocked of blockedPatterns) {
      if (blocked.pattern.test(content)) {
        findings.push({
          file: path.relative(process.cwd(), file),
          label: blocked.label
        });
      }
    }
  }

  if (findings.length) {
    console.error("Extension build check failed. Blocked strings were found in extension/dist:");
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.label}`);
    }
    process.exit(1);
  }

  console.log("Extension build check passed.");
}

await main();
