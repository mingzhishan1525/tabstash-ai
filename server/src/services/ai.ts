import OpenAI from "openai";
import { analyzeResultSchema, type AnalyzeRequest, type AnalyzeResult } from "../schemas/analyze.js";

type Provider = "openai" | "deepseek" | "mock";

const systemPrompt = `You are TabStash AI. Convert a web page into compact structured knowledge for a Notion/Obsidian power user.
Return only valid JSON with this exact shape:
{
  "title": "web page title",
  "brief": "one sentence core idea",
  "tags": ["tag1", "tag2"],
  "bulletPoints": ["point1", "point2", "point3"]
}
Rules:
- Keep tags short, human-readable, and useful for retrieval.
- Write 3 bulletPoints when possible.
- Do not include markdown fences.
- Do not invent facts that are not supported by the content.`;

function getProvider(): Provider {
  if (process.env.AI_PROVIDER === "mock") return "mock";
  return process.env.AI_PROVIDER === "deepseek" ? "deepseek" : "openai";
}

function getClient(provider: Provider) {
  if (provider === "deepseek") {
    return new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com"
    });
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

function getModel(provider: Provider) {
  if (provider === "mock") return "mock";
  if (provider === "deepseek") return process.env.DEEPSEEK_MODEL || "deepseek-chat";
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function mockAnalyze(request: AnalyzeRequest): AnalyzeResult {
  const words = request.content
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const brief = words.length
    ? words.slice(0, 24).join(" ")
    : `${request.title} was saved, but readable body content was not available.`;
  const hostname = new URL(request.url).hostname.replace(/^www\./, "");
  const inferredTags = [
    hostname.split(".")[0] || "web",
    words.length > 100 ? "long-read" : "reference",
    "tabstash"
  ];

  return analyzeResultSchema.parse({
    title: request.title,
    brief,
    tags: [...new Set(inferredTags)].slice(0, 3),
    bulletPoints: [
      `Source: ${hostname}`,
      `Readable words captured: ${words.length}`,
      words.length ? `Opening idea: ${words.slice(0, 12).join(" ")}` : "No readable body was captured."
    ]
  });
}

function parseJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

async function requestAnalysis(request: AnalyzeRequest, retryHint?: string): Promise<AnalyzeResult> {
  const provider = getProvider();
  if (provider === "mock") return mockAnalyze(request);
  const client = getClient(provider);
  const model = getModel(provider);
  const userContent = [
    `Title: ${request.title}`,
    `URL: ${request.url}`,
    "",
    "Readable page content, truncated to 5000 characters:",
    request.content || "No readable content was available."
  ].join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format:
      provider === "openai"
        ? {
            type: "json_schema",
            json_schema: {
              name: "tabstash_analysis",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["title", "brief", "tags", "bulletPoints"],
                properties: {
                  title: { type: "string" },
                  brief: { type: "string" },
                  tags: {
                    type: "array",
                    items: { type: "string" }
                  },
                  bulletPoints: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        : { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      ...(retryHint ? [{ role: "user" as const, content: retryHint }] : []),
      { role: "user", content: userContent }
    ]
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response.");

  return analyzeResultSchema.parse(parseJson(content));
}

export async function analyzePage(request: AnalyzeRequest): Promise<AnalyzeResult> {
  if (getProvider() === "mock") return mockAnalyze(request);

  if (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    throw new Error("AI API key is not configured.");
  }

  try {
    return await requestAnalysis(request);
  } catch (firstError) {
    try {
      return await requestAnalysis(
        request,
        `The previous response was invalid JSON or failed schema validation: ${
          firstError instanceof Error ? firstError.message : "unknown error"
        }. Return only valid JSON matching the required schema.`
      );
    } catch {
      throw new Error("AI analysis failed after retry.");
    }
  }
}
