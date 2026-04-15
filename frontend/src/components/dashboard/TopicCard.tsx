import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { TopicSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-sky-50 border-sky-200",
  "bg-violet-50 border-violet-200",
  "bg-emerald-50 border-emerald-200",
  "bg-amber-50 border-amber-200",
  "bg-rose-50 border-rose-200",
  "bg-cyan-50 border-cyan-200",
];

function sentimentClass(score: number): string {
  if (score >= 6.5) return "text-emerald-600 bg-emerald-50 border border-emerald-200";
  if (score >= 4.0) return "text-amber-600 bg-amber-50 border border-amber-200";
  return "text-red-500 bg-red-50 border border-red-200";
}

interface StructuredSummary {
  summary: string;
  key_concerns: string;
  suggestions: string;
  positive_feedback?: string;
}

function parseSummary(raw: string): StructuredSummary | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "summary" in parsed) {
      return parsed as StructuredSummary;
    }
  } catch {
    // fall through
  }
  return null;
}

/** Strip markdown formatting and LLM-added "Topic - Section:" prefixes. */
function cleanField(text: string): string {
  if (!text) return text;
  return text
    .replace(/^#+\s+/gm, "")                          // heading markers
    .replace(/\*\*(.+?)\*\*/g, "$1")                   // bold
    .replace(/\*(.+?)\*/g, "$1")                        // italic
    .replace(/`(.+?)`/g, "$1")                          // inline code
    .replace(                                            // "Topic - Section type" prefix (with or without colon)
      /^.+?[-–]\s*(?:feedback\s+)?(?:summary|key concerns?|suggestions?|positive feedback|improvements?)[:\s]*/i,
      "",
    )
    .trim();
}

interface SectionProps {
  heading: string;
  body: string;
}

function Section({ heading, body }: SectionProps) {
  const cleaned = cleanField(body);
  if (!cleaned) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
        {heading}
      </p>
      <p className="text-xs text-slate-600 leading-relaxed">{cleaned}</p>
    </div>
  );
}

interface Props {
  topic: TopicSummary;
  index: number;
  totalResponses: number;
}

export function TopicCard({ topic, index, totalResponses }: Props) {
  const [expanded, setExpanded] = useState(false);
  const palette = PALETTE[index % PALETTE.length];
  const pct = Math.round((topic.count / totalResponses) * 100);
  const structured = parseSummary(topic.llm_summary);

  return (
    <div className={cn("rounded-xl border p-5 transition-all", palette)}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-slate-800 text-sm">{topic.label}</h3>
        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", sentimentClass(topic.avg_sentiment))}>
          {topic.avg_sentiment.toFixed(1)} / 10
        </span>
      </div>
      <p className="text-xs text-slate-400 mt-0.5">
        {topic.count} responses · {pct}% of total
      </p>

      {/* Working definition */}
      <div className="mt-3 pt-3 border-t border-black/5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Working Definition
        </p>
        <p className="text-xs text-slate-600 italic leading-relaxed">{topic.description}</p>
      </div>

      {/* Structured sections */}
      <div className="mt-3 pt-3 border-t border-black/5 space-y-3">
        {structured ? (
          <>
            <Section heading="Summary" body={structured.summary} />
            <Section heading="Key Concerns" body={structured.key_concerns} />
            <Section heading="Suggestions for Improvement" body={structured.suggestions} />
            {structured.positive_feedback && (
              <Section heading="Positive Feedback" body={structured.positive_feedback} />
            )}
          </>
        ) : (
          <Section heading="Summary" body={topic.llm_summary} />
        )}
      </div>

      {/* Sample responses toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-slate-400 mt-3 hover:text-slate-600 transition-colors"
      >
        {expanded ? <><ChevronUp size={14} /> Hide samples</> : <><ChevronDown size={14} /> Show sample responses</>}
      </button>

      {expanded && (
        <ul className="mt-3 space-y-2">
          {topic.sample_responses.map((r, i) => (
            <li key={i} className="text-xs text-slate-600 bg-white/70 rounded-lg px-3 py-2 border border-white">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
