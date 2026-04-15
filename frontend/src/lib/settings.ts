import type { Settings } from "./types";

const KEY = "textsense_settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Settings;
  } catch {
    // ignore
  }
  return { provider: "anthropic", api_key: "", model: "claude-sonnet-4-6" };
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
