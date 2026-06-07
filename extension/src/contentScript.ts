import { Readability } from "@mozilla/readability";
import type { ExtractedPage } from "./types";

const MAX_CONTENT_LENGTH = 5000;

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_CONTENT_LENGTH);
}

function semanticFallbackText() {
  const container =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.body;

  return cleanText(container?.textContent || "");
}

function extractReadablePage(): ExtractedPage {
  const fallbackTitle = document.title || location.hostname || "Untitled page";
  const url = location.href;

  try {
    const documentClone = document.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();

    if (!article?.textContent?.trim()) {
      return {
        title: fallbackTitle,
        url,
        excerpt: "",
        textContent: semanticFallbackText()
      };
    }

    return {
      title: article.title || fallbackTitle,
      url,
      excerpt: article.excerpt || "",
      textContent: cleanText(article.textContent)
    };
  } catch {
    return {
      title: fallbackTitle,
      url,
      excerpt: "",
      textContent: semanticFallbackText()
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "TABSTASH_EXTRACT_PAGE") return false;

  sendResponse({
    ok: true,
    page: extractReadablePage()
  });

  return true;
});
