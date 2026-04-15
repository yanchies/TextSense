import type {
  AnalysisResult,
  AnalysisStartRequest,
  ExportFormat,
  ProgressEvent,
  UploadResponse,
} from "./types";

const BASE = "";  // proxied via Vite dev server to http://localhost:8000

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Upload failed");
  return res.json();
}

export async function uploadText(text: string): Promise<UploadResponse> {
  const form = new FormData();
  form.append("text", text);
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Upload failed");
  return res.json();
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export async function startAnalysis(req: AnalysisStartRequest): Promise<void> {
  const res = await fetch(`${BASE}/analysis/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to start analysis");
}

export function streamProgress(
  sessionId: string,
  onEvent: (event: ProgressEvent) => void,
  onClose: () => void,
  onError: (msg: string) => void,
): EventSource {
  const es = new EventSource(`${BASE}/analysis/stream/${sessionId}`);

  es.onmessage = (e) => {
    const data: ProgressEvent = JSON.parse(e.data);
    onEvent(data);
  };

  es.addEventListener("close", () => {
    es.close();
    onClose();
  });

  es.onerror = () => {
    es.close();
    onError("Connection to analysis stream lost.");
  };

  return es;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export async function fetchResult(sessionId: string): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/results/${sessionId}`);
  if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to fetch results");
  return res.json();
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function downloadExport(
  sessionId: string,
  format: "csv",
): Promise<void> {
  const res = await fetch(`${BASE}/export/${sessionId}/${format}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "textsense_results.csv";
  a.click();
  URL.revokeObjectURL(url);
}
