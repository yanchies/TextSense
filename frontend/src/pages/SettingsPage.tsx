import { ChevronDown, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { loadSettings, saveSettings } from "@/lib/settings";
import type { Provider, Settings } from "@/lib/types";
import { DEFAULT_MODELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState(false);

  // Reset model when provider changes
  useEffect(() => {
    const models = DEFAULT_MODELS[settings.provider];
    if (!models.includes(settings.model)) {
      setSettings((s) => ({ ...s, model: models[0] }));
    }
  }, [settings.provider]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-6">
        Your API key is stored in browser localStorage only — never sent anywhere except
        directly to your chosen provider.
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            LLM Provider
          </label>
          <div className="relative">
            <select
              value={settings.provider}
              onChange={(e) =>
                setSettings((s) => ({ ...s, provider: e.target.value as Provider }))
              }
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Model</label>
          <div className="relative">
            <select
              value={settings.model}
              onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {DEFAULT_MODELS[settings.provider].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>

        {/* API key */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            API Key
          </label>
          <input
            type="password"
            value={settings.api_key}
            onChange={(e) => setSettings((s) => ({ ...s, api_key: e.target.value }))}
            placeholder={
              settings.provider === "anthropic" ? "sk-ant-..." : "sk-..."
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
          />
        </div>

        <button
          type="submit"
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors",
            saved
              ? "bg-emerald-500 text-white"
              : "bg-brand-600 text-white hover:bg-brand-700",
          )}
        >
          <Save size={15} />
          {saved ? "Saved!" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
