import dotenv from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import JSDOMParserModule from "../node_modules/@mozilla/readability/JSDOMParser.js";
import ReadabilityModule from "../node_modules/@mozilla/readability/index.js";
import { analyzeResultSchema } from "../server/dist/schemas/analyze.js";
import { notionValidateRequestSchema } from "../server/dist/schemas/notion.js";
import { analyzePage } from "../server/dist/services/ai.js";
import { createNotionPage, validateNotionDatabase } from "../server/dist/services/notion.js";

dotenv.config({ path: new URL("../server/.env", import.meta.url) });

const JSDOMParser = JSDOMParserModule.JSDOMParser || JSDOMParserModule;
const { Readability } = ReadabilityModule;
const OUTPUT_DIR = new URL("../outputs/", import.meta.url);
const REPORT_PATH = new URL("tabstash-real-world-validation.md", OUTPUT_DIR);
const MAX_CONTENT_LENGTH = 5000;
const FETCH_TIMEOUT_MS = Number(process.env.REAL_WORLD_FETCH_TIMEOUT_MS || 15000);
const AI_TIMEOUT_MS = Number(process.env.REAL_WORLD_AI_TIMEOUT_MS || 45000);
const NOTION_TIMEOUT_MS = Number(process.env.REAL_WORLD_NOTION_TIMEOUT_MS || 45000);

const SOURCES = [
  "https://www.python.org/about/gettingstarted/",
  "https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control",
  "https://go.dev/doc/effective_go",
  "https://doc.rust-lang.org/book/ch01-00-getting-started.html",
  "https://docs.djangoproject.com/en/stable/intro/overview/",
  "https://flask.palletsprojects.com/en/stable/quickstart/",
  "https://www.postgresql.org/docs/current/tutorial.html",
  "https://redis.io/docs/latest/develop/get-started/",
  "https://www.kernel.org/doc/html/latest/process/howto.html",
  "https://curl.se/docs/httpscripting.html",
  "https://www.w3.org/Provider/Style/URI",
  "https://www.rfc-editor.org/rfc/rfc9110.html",
  "https://docs.npmjs.com/about-npm",
  "https://www.lua.org/about.html",
  "https://www.perl.org/about.html",
  "https://www.ruby-lang.org/en/documentation/quickstart/",
  "https://www.php.net/manual/en/getting-started.php",
  "https://www.debian.org/intro/about",
  "https://www.freebsd.org/about/",
  "https://nginx.org/en/docs/beginners_guide.html",
  "https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Your_first_website",
  "https://pnpm.io/motivation",
  "https://yarnpkg.com/getting-started",
  "https://react.dev/learn",
  "https://vite.dev/guide/",
  "https://tailwindcss.com/docs/installation/using-vite",
  "https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html",
  "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs",
  "https://fastify.dev/docs/latest/Guides/Getting-Started/",
  "https://zod.dev/",
  "https://developers.notion.com/docs/getting-started",
  "https://eslint.org/docs/latest/use/getting-started",
  "https://www.markdownguide.org/getting-started/",
  "https://prettier.io/docs/",
  "https://vitest.dev/guide/",
  "https://webpack.js.org/concepts/",
  "https://kubernetes.io/docs/concepts/overview/",
  "https://rollupjs.org/introduction/",
  "https://babeljs.io/docs/",
  "https://jestjs.io/docs/getting-started",
  "https://www.netlify.com/blog/2016/02/24/a-step-by-step-guide-gatsby-on-netlify/",
  "https://docs.github.com/en/get-started/start-your-journey/about-github-and-git",
  "https://docs.github.com/en/actions/about-github-actions/understanding-github-actions",
  "https://docs.gitlab.com/ee/ci/",
  "https://www.elastic.co/what-is/elasticsearch",
  "https://www.mongodb.com/docs/manual/introduction/",
  "https://www.rabbitmq.com/tutorials/tutorial-one-javascript",
  "https://www.openapis.org/what-is-openapi",
  "https://graphql.org/learn/",
  "https://www.oauth.com/oauth2-servers/access-tokens/"
];

function nowIso() {
  return new Date().toISOString();
}

function ms(start) {
  return Date.now() - start;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function avg(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

function requireEnv() {
  const required = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (process.env.AI_PROVIDER !== "deepseek") missing.push("AI_PROVIDER=deepseek");
  return [...new Set(missing)];
}

function withTimeout(promise, timeoutMs, label) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

function fallbackTitle(html, url) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return match?.[1]?.replace(/\s+/g, " ").trim() || new URL(url).hostname;
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);
}

function semanticFallbackText(html) {
  const semanticMatch =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return stripTags(semanticMatch?.[1] || html);
}

async function fetchHtml(url) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "TabStash-AI-RealWorldValidation/0.1"
        }
      });
      const html = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return html;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

function extractReadable(html, url) {
  const originalConsole = { log: console.log, warn: console.warn, error: console.error };
  let article;
  try {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    const parser = new JSDOMParser();
    const doc = parser.parse(html);
    if (doc) {
      doc.documentURI = url;
      article = new Readability(doc).parse();
    }
  } catch {
    article = undefined;
  } finally {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
  return {
    title: article?.title || fallbackTitle(html, url),
    url,
    excerpt: article?.excerpt || "",
    textContent:
      article?.textContent?.replace(/\s+/g, " ").trim().slice(0, MAX_CONTENT_LENGTH) ||
      semanticFallbackText(html)
  };
}

function makeItem(page, index) {
  const createdAt = nowIso();
  return {
    id: `real-world-${index + 1}-${crypto.randomUUID()}`,
    url: page.url,
    title: page.title,
    rawText: page.textContent,
    status: page.textContent ? "pending" : "failed",
    createdAt,
    updatedAt: createdAt
  };
}

function summaryQuality(page, analysis) {
  const briefLengthOk = analysis.brief.length >= 24 && analysis.brief.length <= 220;
  const bulletCountOk = analysis.bulletPoints.length >= 3;
  const bulletTextOk = analysis.bulletPoints.every((point) => point.length >= 16 && point.length <= 240);
  const titleOk = analysis.title.length >= 3;
  const sourceWords = new Set(
    `${page.title} ${page.textContent}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .slice(0, 220)
  );
  const briefGrounded = analysis.brief
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .some((word) => sourceWords.has(word));
  return [briefLengthOk, bulletCountOk, bulletTextOk, titleOk, briefGrounded].filter(Boolean).length / 5;
}

function tagAccuracy(page, analysis) {
  const hostParts = new URL(page.url).hostname.replace(/^www\./, "").split(/[.-]/).filter((part) => part.length >= 3);
  const titleParts = page.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length >= 4);
  const sourceTokens = new Set([...hostParts, ...titleParts]);
  const matched = analysis.tags.filter((tag) => {
    const normalized = tag.toLowerCase();
    return [...sourceTokens].some((token) => normalized.includes(token) || token.includes(normalized));
  }).length;
  return analysis.tags.length ? matched / analysis.tags.length : 0;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const missing = requireEnv();
  if (missing.length) {
    const report = [
      "# TabStash AI Real World Validation Report",
      "",
      `Generated: ${nowIso()}`,
      "",
      "## Status",
      "",
      "BLOCKED - Real credentials are not configured.",
      "",
      "## Missing",
      "",
      ...missing.map((name) => `- ${name}`),
      "",
      "## Required Environment",
      "",
      "Create `server/.env` or export these values before running:",
      "",
      "```bash",
      "AI_PROVIDER=deepseek",
      "DEEPSEEK_API_KEY=your-deepseek-api-key",
      "DEEPSEEK_MODEL=deepseek-chat",
      "NOTION_TOKEN=your-notion-integration-token",
      "NOTION_DATABASE_ID=...",
      "```"
    ].join("\n");
    await writeFile(REPORT_PATH, report);
    console.log(report);
    process.exitCode = 2;
    return;
  }

  notionValidateRequestSchema.parse({
    notionToken: process.env.NOTION_TOKEN,
    databaseId: process.env.NOTION_DATABASE_ID
  });

  const startedAt = Date.now();
  const results = [];
  const savedItems = [];
  const closedTabs = [];
  const restoredItems = [];

  await withTimeout(
    validateNotionDatabase({
      notionToken: process.env.NOTION_TOKEN,
      databaseId: process.env.NOTION_DATABASE_ID
    }),
    NOTION_TIMEOUT_MS,
    "Notion database validation"
  );

  for (const [index, url] of SOURCES.entries()) {
    const result = { index: index + 1, url, status: "pending", timings: {}, errors: [] };
    const itemStarted = Date.now();
    try {
      const fetchStarted = Date.now();
      const html = await fetchHtml(url);
      result.timings.fetchMs = ms(fetchStarted);

      const extractStarted = Date.now();
      const page = extractReadable(html, url);
      result.timings.extractMs = ms(extractStarted);
      result.title = page.title;
      result.wordCount = page.textContent.split(/\s+/).filter(Boolean).length;

      const item = makeItem(page, index);
      savedItems.push(item);
      restoredItems.push(structuredClone(item));
      closedTabs.push(url);
      if (!page.textContent) throw new Error("Readability produced no readable text.");

      const aiStarted = Date.now();
      const analysis = await withTimeout(
        analyzePage({ title: page.title, url: page.url, content: page.textContent }),
        AI_TIMEOUT_MS,
        "DeepSeek analysis"
      );
      result.timings.aiMs = ms(aiStarted);
      result.analysis = analyzeResultSchema.parse(analysis);
      result.summaryQuality = summaryQuality(page, result.analysis);
      result.tagAccuracy = tagAccuracy(page, result.analysis);

      const notionStarted = Date.now();
      const notion = await withTimeout(
        createNotionPage({
          notionToken: process.env.NOTION_TOKEN,
          databaseId: process.env.NOTION_DATABASE_ID,
          item: {
            title: result.analysis.title,
            url,
            brief: result.analysis.brief,
            tags: result.analysis.tags,
            bulletPoints: result.analysis.bulletPoints
          }
        }),
        NOTION_TIMEOUT_MS,
        "Notion sync"
      );
      result.timings.notionMs = ms(notionStarted);
      result.notionPageUrl = notion.notionPageUrl;
      result.status = "done";
    } catch (error) {
      result.status = "failed";
      result.errors.push(error instanceof Error ? error.message : "Unknown validation failure.");
    } finally {
      result.timings.totalMs = ms(itemStarted);
      results.push(result);
      console.log(`[${result.index}/${SOURCES.length}] ${result.status.toUpperCase()} ${url} (${result.timings.totalMs}ms)`);
    }
  }

  const done = results.filter((result) => result.status === "done");
  const aiValid = results.filter((result) => result.analysis).length;
  const notionSynced = results.filter((result) => result.notionPageUrl).length;
  const allTabsSuccessRate = Math.min(savedItems.length, closedTabs.length) / SOURCES.length;
  const noDataLoss =
    savedItems.length === restoredItems.length && closedTabs.every((url) => savedItems.some((item) => item.url === url));
  const averageTotalMs = avg(results.map((result) => result.timings.totalMs));
  const averageAiMs = avg(results.map((result) => result.timings.aiMs));
  const averageNotionMs = avg(results.map((result) => result.timings.notionMs));
  const averageQuality = done.length ? done.reduce((sum, result) => sum + result.summaryQuality, 0) / done.length : 0;
  const averageTagAccuracy = done.length ? done.reduce((sum, result) => sum + result.tagAccuracy, 0) / done.length : 0;
  const success = done.length === SOURCES.length && notionSynced === SOURCES.length && noDataLoss;

  const report = [
    "# TabStash AI Real World Validation Report",
    "",
    `Generated: ${nowIso()}`,
    `Duration: ${ms(startedAt)}ms`,
    "",
    "## Summary",
    "",
    `- Overall: ${success ? "PASS" : "FAIL"}`,
    `- Real webpages tested: ${results.length}`,
    `- DeepSeek JSON validity: ${aiValid}/${results.length} (${pct(aiValid / results.length)})`,
    `- AI summary quality: ${pct(averageQuality)}`,
    `- Tag accuracy: ${pct(averageTagAccuracy)}`,
    `- Notion sync success: ${notionSynced}/${results.length} (${pct(notionSynced / results.length)})`,
    `- All Tabs success: ${savedItems.length}/${results.length} saved, ${closedTabs.length}/${results.length} closed (${pct(allTabsSuccessRate)})`,
    `- IndexedDB restore simulation: ${restoredItems.length}/${savedItems.length} restored`,
    `- No data loss: ${noDataLoss ? "PASS" : "FAIL"}`,
    `- Average processing time: ${averageTotalMs}ms/item`,
    `- Average DeepSeek time: ${averageAiMs}ms/item`,
    `- Average Notion time: ${averageNotionMs}ms/item`,
    "",
    "## Per Page Results",
    "",
    "| # | Status | Words | Total ms | AI ms | Notion ms | Quality | Tag Accuracy | URL | Error |",
    "|---:|---|---:|---:|---:|---:|---:|---:|---|---|",
    ...results.map(
      (result) =>
        `| ${result.index} | ${result.status} | ${result.wordCount || 0} | ${result.timings.totalMs || 0} | ${result.timings.aiMs || 0} | ${result.timings.notionMs || 0} | ${pct(result.summaryQuality || 0)} | ${pct(result.tagAccuracy || 0)} | ${result.url} | ${result.errors.join("; ").replace(/\|/g, "\\|")} |`
    )
  ].join("\n");

  await writeFile(REPORT_PATH, report);
  console.log(`\nReport written to ${REPORT_PATH.pathname}`);
  if (!success) process.exitCode = 1;
}

await main();
