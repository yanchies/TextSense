import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 transition-colors cursor-pointer",
        dragging
          ? "border-brand-400 bg-brand-50"
          : "border-slate-200 hover:border-brand-300 hover:bg-slate-50",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <Upload className="text-slate-400" size={32} />
      <div className="text-center">
        <p className="font-medium text-slate-700">Drop a file here, or click to browse</p>
        <p className="text-sm text-slate-400 mt-1">CSV or JSON &mdash; one response per row</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json"
        className="hidden"
        onChange={handleChange}
      />
    </button>
  );
}
