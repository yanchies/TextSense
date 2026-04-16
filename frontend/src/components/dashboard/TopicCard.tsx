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

function sentimentClass(score: number) {
  if (score >= 6.5) return "text-emerald-600 bg-emerald-50 border border-emerald-200";
  if (score >= 4.0) return "text-amber-600 bg-amber-50 border border-amber-200";
  return "text-red-500 bg-red-50 border border-red-200";
}

interface Structured {
  summary: string;
  key_concerns: string;
  suggestions: string;
  positive_feedback: string;
}

function parseStructured(raw: string): Structured | null {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && "summary" in p) {
      return {
        summary:          String(p.summary          ?? ""),
        key_concerns:     String(p.key_concerns     ?? ""),
        suggestions:      String(p.suggestions      ?? ""),
        positive_feedback:String(p.positive_feedback ?? ""),
      };
    }
  } catch {/* fall through */}
  return null;
}

function cleanField(text: string): string {
  return text
    .replace(/^#+\s+/gm, "")                   // markdown headings
    .replace(/\*\*(.+?)\*\*/g, "$1")            // bold
    .replace(/\*(.+?)\*/g, "$1")               // italic
    .replace(/`(.+?)`/g, "$1")                 // inline code
    // "Topic - Section type:" prefix
    .replace(/^.+?[-–]\s*(?:feedback\s+)?(?:summary|key concerns?|suggestions?|positive feedback|improvements?)[:\s]*/gi, "")
    // "Summary of X:" or "Overview of X:" standalone label at start
    .replace(/^(?:overview|summary)(?:\s+of\s+[^.]+)?[:\s]+/gi, "")
    // "X:" label at start of line (e.g. "Overview:", "Problems:")
    .replace(/^\w[\w\s]{0,30}:\s+/, "")
    .trim();
}

function SectionBlock({ heading, body }: { heading: string; body: string }) {
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
  const structured = parseStructured(topic.llm_summary);

  return (
    <div className={cn("rounded-xl border p-5 transition-all", palette)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-slate-800 text-sm">{topic.label}</h3>
          <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", sentimentClass(topic.avg_sentiment))}>
            {topic.avg_sentiment.toFixed(1)} / 10
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-slate-600">{topic.count} responses</p>
          <p className="text-xs text-slate-400">{pct}% of total</p>
        </div>
      </div>

      {/* Working definition */}
      <div className="mt-3 pt-3 border-t border-black/5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Working Definition
        </p>
        <p className="text-xs text-slate-600 italic leading-relaxed">{topic.description}</p>
      </div>

      {/* Structured analysis sections */}
      <div className="mt-3 pt-3 border-t border-black/5 space-y-3">
        {structured ? (
          <>
            <SectionBlock heading="Key Concerns" body={structured.key_concerns} />
            <SectionBlock heading="Suggestions for Improvement" body={structured.suggestions} />
            <SectionBlock heading="Positive Feedback" body={structured.positive_feedback} />
          </>
        ) : null}
      </div>

      {/* Sample responses toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-slate-400 mt-3 hover:text-slate-600 transition-colors"
      >
        {expanded
          ? <><ChevronUp size={14} /> Hide samples</>
          : <><ChevronDown size={14} /> Show sample responses</>}
      </button>

      {expanded && (
        <ul className="mt-3 space-y-2">
          {topic.sample_responses.map((r, i) => (
            <li
              key={i}
              className="text-xs text-slate-600 bg-white/70 rounded-lg px-3 py-2 border border-white"
            >
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
