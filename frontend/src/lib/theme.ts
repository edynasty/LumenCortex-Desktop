import { useEffect, useState } from "react";
import { setWindowBackground } from "./bridge";

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

/** "#rrggbb" to its channels; anything else (rgba(), empty before the stylesheet loads) is null. */
export function parseHexColour(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null;
}

/**
 * Paints the native window with the theme's own ground (--bg-window), the colour that shows where
 * the webview has not painted: launch, live resize, overscroll. The token is the single source, so
 * the native colour cannot drift from the CSS.
 */
function syncWindowGround() {
  const ground = parseHexColour(getComputedStyle(document.documentElement).getPropertyValue("--bg-window"));
  if (ground) setWindowBackground(...ground);
}

function setResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  syncWindowGround();
}

export function applyThemePreference(preference: ThemePreference) {
  const resolved = resolveTheme(preference, systemPrefersDark());
  setResolvedTheme(resolved);
  return resolved;
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(initialThemePreference);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference);
    const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
    const sync = () => {
      setResolvedTheme(resolveTheme(preference, Boolean(media?.matches)));
    };

    sync();
    if (preference !== "system" || !media) return;
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [preference]);

  return [preference, setPreference] as const;
}
