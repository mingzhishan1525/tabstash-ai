export type AnalyzeResult = {
  title: string;
  brief: string;
  tags: string[];
  bulletPoints: string[];
};

export type NotionArchiveItem = AnalyzeResult & {
  url: string;
};
