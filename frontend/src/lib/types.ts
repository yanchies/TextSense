export type Provider = "anthropic" | "openai";
export type SentimentLabel = "positive" | "neutral" | "negative";
export type ExportFormat = "csv" | "html";

export interface UploadResponse {
  session_id: string;
  columns: string[];
  row_count: number;
  preview: Record<string, unknown>[];
}

export interface AnalysisStartRequest {
  session_id: string;
  column: string;
  provider: Provider;
  api_key: string;
  model: string;
}

export interface ProgressEvent {
  step: string;
  message: string;
  progress: number;
}

export interface ResponseRecord {
  id: number;
  text: string;
  topic_id: number;
  topic_label: string;
  sentiment: number;
  sentiment_label: SentimentLabel;
}

export interface TopicSummary {
  id: number;
  label: string;
  description: string;
  count: number;
  avg_sentiment: number;
  sample_responses: string[];
  llm_summary: string;
}

export interface AnalysisResult {
  session_id: string;
  total_responses: number;
  responses: ResponseRecord[];
  topics: TopicSummary[];
}

export interface Settings {
  provider: Provider;
  api_key: string;
  model: string;
}

export const DEFAULT_MODELS: Record<Provider, string[]> = {
  anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-opus-4-6"],
  openai: ["gpt-4o-mini", "gpt-4o"],
};
