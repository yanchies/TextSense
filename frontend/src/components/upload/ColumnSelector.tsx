import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  columns: string[];
  selected: string;
  onChange: (col: string) => void;
  rowCount: number;
  preview: Record<string, unknown>[];
}

export function ColumnSelector({ columns, selected, onChange, rowCount, preview }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Which column contains the responses?
        </label>
        <div className="relative inline-block w-full max-w-sm">
          <select
            value={selected}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full appearance-none rounded-lg border border-slate-200 bg-white",
              "px-4 py-2.5 pr-10 text-sm text-slate-800",
              "focus:outline-none focus:ring-2 focus:ring-brand-400",
            )}
          >
            {columns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400">{rowCount} rows detected</p>
      </div>

      {/* Data preview */}
      {preview.length > 0 && selected && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
            Preview (first {preview.length} rows)
          </p>
          <div className="rounded-lg border border-slate-200 overflow-hidden text-sm">
            {preview.map((row, i) => {
              const val = row[selected];
              return (
                <div
                  key={i}
                  className={cn(
                    "px-4 py-2.5 text-slate-700 truncate",
                    i % 2 === 0 ? "bg-white" : "bg-slate-50",
                  )}
                >
                  <span className="text-slate-400 mr-3 font-mono text-xs">{i + 1}</span>
                  {val == null ? (
                    <span className="text-slate-300 italic">empty</span>
                  ) : (
                    String(val)
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
