import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { startAnalysis, uploadFile, uploadText } from "@/lib/api";
import { loadSettings } from "@/lib/settings";
import type { UploadResponse } from "@/lib/types";
import { ColumnSelector } from "@/components/upload/ColumnSelector";
import { TextPaste } from "@/components/upload/TextPaste";
import { UploadZone } from "@/components/upload/UploadZone";
import { cn } from "@/lib/utils";

type Tab = "file" | "text";
type Step = "input" | "configure";

export function HomePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("file");
  const [step, setStep] = useState<Step>("input");
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const data = await uploadFile(file);
      setUploadData(data);
      setSelectedColumn(data.columns[0]);
      setStep("configure");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleText(text: string) {
    setError(null);
    setUploading(true);
    try {
      const data = await uploadText(text);
      setUploadData(data);
      setSelectedColumn(data.columns[0]);
      setStep("configure");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleStart() {
    if (!uploadData) return;
    const settings = loadSettings();
    if (!settings.api_key) {
      setError("No API key set. Go to Settings and add your API key first.");
      return;
    }

    setError(null);
    setStarting(true);
    try {
      await startAnalysis({
        session_id: uploadData.session_id,
        column: selectedColumn,
        provider: settings.provider,
        api_key: settings.api_key,
        model: settings.model,
      });
      navigate(`/dashboard/${uploadData.session_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start analysis");
      setStarting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-800">
          Analyse qualitative feedback
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          Upload a CSV, JSON, or paste text. TextSense will find topics and
          score sentiment automatically.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {step === "input" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-5 w-fit">
            {(["file", "text"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  tab === t
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {t === "file" ? "Upload file" : "Paste text"}
              </button>
            ))}
          </div>

          {tab === "file" ? (
            <UploadZone onFile={handleFile} disabled={uploading} />
          ) : (
            <TextPaste onSubmit={handleText} disabled={uploading} />
          )}

          {uploading && (
            <p className="text-center text-sm text-slate-400 mt-4">Uploading…</p>
          )}
        </div>
      )}

      {step === "configure" && uploadData && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <ColumnSelector
              columns={uploadData.columns}
              selected={selectedColumn}
              onChange={setSelectedColumn}
              rowCount={uploadData.row_count}
              preview={uploadData.preview}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setStep("input"); setUploadData(null); }}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Start over
            </button>

            <button
              onClick={handleStart}
              disabled={starting || !selectedColumn}
              className="px-6 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors"
            >
              {starting ? "Starting…" : "Run analysis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
