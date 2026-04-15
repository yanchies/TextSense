import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { downloadExport } from "@/lib/api";
import { generateHtml } from "@/lib/htmlExport";
import type { AnalysisResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  result: AnalysisResult;
}

export function ExportBar({ sessionId, result }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCsv() {
    setLoading("csv");
    try {
      await downloadExport(sessionId, "csv");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  }

  function handleHtml() {
    setLoading("html");
    try {
      const html = generateHtml(result);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "textsense_results.html";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }

  const btnClass = (key: string) =>
    cn(
      "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
      loading === key
        ? "bg-brand-50 border-brand-200 text-brand-600 cursor-wait"
        : "border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40",
    );

  return (
    <div className="flex items-center gap-2 no-print">
      <Download size={15} className="text-slate-400" />
      <span className="text-sm text-slate-500 mr-1">Export:</span>

      <button onClick={handleCsv} disabled={loading !== null} className={btnClass("csv")}>
        {loading === "csv" ? "..." : "CSV"}
      </button>

      <button onClick={handleHtml} disabled={loading !== null} className={btnClass("html")}>
        {loading === "html" ? "..." : "HTML"}
      </button>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
      >
        <Printer size={13} />
        Print / PDF
      </button>
    </div>
  );
}
