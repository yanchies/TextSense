import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function TextPaste({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={8}
        placeholder={"Paste responses here — one per line.\n\nExample:\nThe onboarding process was smooth and well-structured.\nNeed better documentation for advanced features.\nLoved the customer support team."}
        className={cn(
          "w-full rounded-lg border border-slate-200 bg-white px-4 py-3",
          "text-sm text-slate-800 placeholder:text-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className={cn(
          "self-end px-5 py-2 rounded-lg text-sm font-medium transition-colors",
          "bg-brand-600 text-white hover:bg-brand-700",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        Use this text
      </button>
    </form>
  );
}
