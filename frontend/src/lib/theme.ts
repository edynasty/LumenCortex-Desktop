import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "lcx-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function initialThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

function systemPrefersDark() {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

export function applyThemePreference(preference: ThemePreference) {
  const resolved = resolveTheme(preference, systemPrefersDark());
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(initialThemePreference);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference);
    const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
    const sync = () => {
      const resolved = resolveTheme(preference, Boolean(media?.matches));
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };

    sync();
    if (preference !== "system" || !media) return;
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [preference]);

  return [preference, setPreference] as const;
}
