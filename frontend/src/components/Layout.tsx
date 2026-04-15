import { Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-semibold text-lg tracking-tight text-slate-900">
              TextSense
            </span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">
              v2
            </span>
          </Link>

          <Link
            to="/settings"
            className={cn(
              "p-2 rounded-md transition-colors",
              pathname === "/settings"
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
            )}
            aria-label="Settings"
          >
            <Settings size={18} />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 py-4">
        <p className="text-center text-xs text-slate-400">
          TextSense v2 &mdash; built on{" "}
          <a
            href="https://github.com/yanchies/PICTSense"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-600"
          >
            PICTSense
          </a>
        </p>
      </footer>
    </div>
  );
}
