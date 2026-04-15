import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchResult, streamProgress } from "@/lib/api";
import type { AnalysisResult, ProgressEvent } from "@/lib/types";
import { ProgressPanel } from "@/components/ProgressPanel";
import { ExportBar } from "@/components/export/ExportBar";
import { ResponseTable } from "@/components/dashboard/ResponseTable";
import { SentimentChart } from "@/components/dashboard/SentimentChart";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { TopicCard } from "@/components/dashboard/TopicCard";
import { TopicChart } from "@/components/dashboard/TopicChart";

export function DashboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const hadSSEError = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    esRef.current = streamProgress(
      sessionId,
      (ev) => {
        setEvents((prev) => [...prev, ev]);
        if (ev.step === "error") {
          hadSSEError.current = true;
          setError(ev.message);
        }
      },
      async () => {
        setDone(true);
        // Don't attempt to fetch results if the pipeline already reported an
        // error via SSE — that error message is more useful than a generic 425.
        if (hadSSEError.current) return;
        try {
          const res = await fetchResult(sessionId);
          setResult(res);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "Failed to load results");
        }
      },
      (msg) => setError(msg),
    );

    return () => esRef.current?.close();
  }, [sessionId]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Analysis failed</p>
            <p>{error}</p>
            <button
              onClick={() => navigate("/")}
              className="mt-3 underline text-red-500 hover:text-red-700"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!done || !result) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProgressPanel events={events} latest={events[events.length - 1] ?? null} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Results</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {result.total_responses} responses · {result.topics.length} topics
          </p>
        </div>
        <ExportBar sessionId={result.session_id} result={result} />
      </div>

      {/* Stats */}
      <StatsBar result={result} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopicChart topics={result.topics} totalResponses={result.total_responses} />
        <SentimentChart topics={result.topics} />
      </div>

      {/* Topic cards */}
      <div>
        <h2 className="font-semibold text-slate-700 mb-3">Topics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {result.topics
            .slice()
            .sort((a, b) => b.count - a.count)
            .map((t, i) => (
              <TopicCard
                key={t.id}
                topic={t}
                index={i}
                totalResponses={result.total_responses}
              />
            ))}
        </div>
      </div>

      {/* Response table */}
      <div>
        <h2 className="font-semibold text-slate-700 mb-3">All Responses</h2>
        <ResponseTable responses={result.responses} topics={result.topics} />
      </div>
    </div>
  );
}
