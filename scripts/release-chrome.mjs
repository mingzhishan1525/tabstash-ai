import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const zipPath = path.join(root, "tabstash-ai-chrome.zip");

await rm(zipPath, { force: true });

const result = spawnSync("zip", ["-r", zipPath, "."], {
  cwd: path.join(root, "extension", "dist"),
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`Chrome Store release package created: ${zipPath}`);
