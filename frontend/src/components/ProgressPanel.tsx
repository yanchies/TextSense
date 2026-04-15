import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProgressEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "parsing",    label: "Parse" },
  { key: "embedding", label: "Embed" },
  { key: "clustering",label: "Cluster" },
  { key: "labelling", label: "Label" },
  { key: "sentiment", label: "Sentiment" },
  { key: "assembling",label: "Assemble" },
  { key: "complete",  label: "Done" },
];

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

interface Props {
  events: ProgressEvent[];
  latest: ProgressEvent | null;
}

export function ProgressPanel({ events, latest }: Props) {
  const progress = latest?.progress ?? 0;
  const isError = latest?.step === "error";
  const isDone = progress === 100 && !isError;
  const activeStep = latest?.step ?? "";

  // Elapsed time
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Start clock on first event
    if (events.length > 0 && startRef.current === null) {
      startRef.current = Date.now();
    }
  }, [events.length]);

  useEffect(() => {
    if (isDone || isError) {
      // Snap to final value
      if (startRef.current) {
        setElapsed(Math.round((Date.now() - startRef.current) / 1000));
      }
      return;
    }
    if (startRef.current === null) return;

    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current!) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isDone, isError]);

  function stepState(key: string): "done" | "active" | "pending" {
    const stepKeys = STEPS.map((s) => s.key);
    const activeIdx = stepKeys.indexOf(activeStep);
    const thisIdx = stepKeys.indexOf(key);
    if (isError) return thisIdx <= activeIdx ? "done" : "pending";
    if (key === "complete") return activeStep === "complete" ? "done" : "pending";
    if (thisIdx < activeIdx) return "done";
    if (thisIdx === activeIdx) return "active";
    return "pending";
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isError && !isDone && (
            <Loader2 size={18} className="text-brand-500 animate-spin shrink-0" />
          )}
          {isError && <XCircle size={18} className="text-red-500 shrink-0" />}
          {isDone && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
          <h2 className="font-semibold text-slate-800">
            {isError ? "Analysis failed" : isDone ? "Analysis complete" : "Analysing…"}
          </h2>
        </div>
        {elapsed > 0 && (
          <span className="text-xs text-slate-400 tabular-nums">
            {formatElapsed(elapsed)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isError ? "bg-red-400" : "bg-brand-500",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps row */}
      <div className="flex items-start justify-between gap-1">
        {STEPS.filter((s) => s.key !== "complete").map((s) => {
          const state = stepState(s.key);
          return (
            <div key={s.key} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={cn(
                  "w-2 h-2 rounded-full mt-0.5",
                  state === "done" && "bg-brand-500",
                  state === "active" && "bg-brand-500 ring-2 ring-brand-200",
                  state === "pending" && "bg-slate-200",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight",
                  state === "active" && "text-brand-600",
                  state === "done" && "text-slate-500",
                  state === "pending" && "text-slate-300",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current message */}
      {latest && (
        <p className={cn("text-sm", isError ? "text-red-500" : "text-slate-600")}>
          {latest.message}
        </p>
      )}
    </div>
  );
}
