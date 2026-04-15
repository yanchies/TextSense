import type { AnalysisResult } from "@/lib/types";

interface Props {
  result: AnalysisResult;
}

export function StatsBar({ result }: Props) {
  const avgSentiment =
    result.responses.reduce((sum, r) => sum + r.sentiment, 0) / result.total_responses;

  const positiveCount = result.responses.filter((r) => r.sentiment_label === "positive").length;
  const negativeCount = result.responses.filter((r) => r.sentiment_label === "negative").length;
  const neutralCount = result.total_responses - positiveCount - negativeCount;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Responses</p>
        <p className="text-2xl font-semibold text-slate-800 mt-1">
          {result.total_responses.toLocaleString()}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Topics</p>
        <p className="text-2xl font-semibold text-slate-800 mt-1">{result.topics.length}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Avg sentiment</p>
        <p className="text-2xl font-semibold text-slate-800 mt-1">
          {avgSentiment.toFixed(1)} / 10
        </p>
      </div>

      {/* Breakdown card */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Breakdown</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xl font-semibold text-emerald-500">
            {positiveCount}
          </span>
          <span className="text-slate-200 font-light text-xl select-none">|</span>
          <span className="text-2xl font-semibold text-amber-500">
            {neutralCount}
          </span>
          <span className="text-slate-200 font-light text-xl select-none">|</span>
          <span className="text-2xl font-semibold text-red-400">
            {negativeCount}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-emerald-500">pos</span>
          <span className="text-[10px] text-slate-200 select-none">|</span>
          <span className="text-[10px] text-amber-500">neu</span>
          <span className="text-[10px] text-slate-200 select-none">|</span>
          <span className="text-[10px] text-red-400">neg</span>
        </div>
      </div>
    </div>
  );
}
