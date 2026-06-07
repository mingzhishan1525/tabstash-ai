import { Client } from "@notionhq/client";
import type {
  BlockObjectRequest,
  PageObjectResponse
} from "@notionhq/client/build/src/api-endpoints.js";
import type { NotionCreateRequest, NotionValidateRequest } from "../schemas/notion.js";

const REQUIRED_PROPERTIES = {
  URL: "url",
  Brief: "rich_text",
  Tags: "multi_select",
  Source: "select",
  Created: "date"
} as const;

function findTitlePropertyName(properties: Record<string, { type: string }>) {
  return Object.entries(properties).find(([, property]) => property.type === "title")?.[0];
}

function richText(content: string) {
  return [{ type: "text" as const, text: { content: content.slice(0, 2000) } }];
}

function heading(content: string): BlockObjectRequest {
  return {
    object: "block",
    type: "heading_1",
    heading_1: {
      rich_text: richText(content)
    }
  };
}

function paragraph(content: string): BlockObjectRequest {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: richText(content)
    }
  };
}

function bullet(content: string): BlockObjectRequest {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: richText(content)
    }
  };
}

function bookmark(url: string): BlockObjectRequest {
  return {
    object: "block",
    type: "bookmark",
    bookmark: {
      url
    }
  };
}

function pageUrl(page: PageObjectResponse) {
  return page.url;
}

function getNotionClient(token: string) {
  return new Client({ auth: token });
}

export async function validateNotionDatabase(request: NotionValidateRequest) {
  const notion = getNotionClient(request.notionToken);
  const database = await notion.databases.retrieve({
    database_id: request.databaseId
  });

  if (!("properties" in database)) {
    throw new Error("Notion database could not be inspected.");
  }

  const properties = database.properties as Record<string, { type: string }>;
  const titlePropertyName = findTitlePropertyName(properties);
  const missingOrInvalid = Object.entries(REQUIRED_PROPERTIES).filter(([name, type]) => {
    return properties[name]?.type !== type;
  });

  if (!titlePropertyName || missingOrInvalid.length) {
    const expected = missingOrInvalid.map(([name, type]) => `${name}: ${type}`).join(", ");
    throw new Error(
      `Notion database fields do not match the TabStash AI template. Expected title property, ${expected}.`
    );
  }

  return {
    success: true as const,
    databaseTitle:
      "title" in database && Array.isArray(database.title)
        ? database.title.map((part) => ("plain_text" in part ? part.plain_text : "")).join("")
        : ""
  };
}

export async function createNotionPage(request: NotionCreateRequest) {
  const notion = getNotionClient(request.notionToken);
  const { item } = request;
  const database = await notion.databases.retrieve({
    database_id: request.databaseId
  });

  if (!("properties" in database)) {
    throw new Error("Notion database could not be inspected.");
  }

  const titlePropertyName = findTitlePropertyName(database.properties as Record<string, { type: string }>);
  if (!titlePropertyName) {
    throw new Error("Notion database fields do not match the TabStash AI template.");
  }

  const children: BlockObjectRequest[] = [
    heading("AI Summary"),
    paragraph(item.brief),
    heading("Key Points"),
    ...item.bulletPoints.map(bullet),
    heading("Original URL"),
    bookmark(item.url)
  ];

  const response = await notion.pages.create({
    parent: {
      database_id: request.databaseId
    },
    properties: {
      [titlePropertyName]: {
        title: richText(item.title)
      },
      URL: {
        url: item.url
      },
      Brief: {
        rich_text: richText(item.brief)
      },
      Tags: {
        multi_select: item.tags.map((name) => ({ name }))
      },
      Source: {
        select: { name: "TabStash AI" }
      },
      Created: {
        date: { start: new Date().toISOString() }
      }
    },
    children
  });

  if (!("url" in response)) {
    throw new Error("Notion did not return a page URL.");
  }

  return {
    success: true as const,
    notionPageUrl: pageUrl(response as PageObjectResponse)
  };
}
