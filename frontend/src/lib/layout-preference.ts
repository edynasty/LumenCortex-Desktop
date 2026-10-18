import { useEffect, useState } from "react";

// Pane geometry the user chose. UI preference only: no session or workspace data.
export type LayoutPreference = {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
};

export const SIDEBAR_WIDTH = { min: 216, max: 380, initial: 264 };
export const INSPECTOR_WIDTH = { min: 280, max: 440, initial: 320 };

const STORAGE_KEY = "lcx-layout";
// Pre-Lumen-Glass key; read once so an existing collapse choice survives the upgrade.
const LEGACY_COLLAPSED_KEY = "lcx-sidebar-collapsed";

function width(value: unknown, bounds: { min: number; max: number; initial: number }) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.min(bounds.max, Math.max(bounds.min, value)))
    : bounds.initial;
}

export function initialLayoutPreference(): LayoutPreference {
  let stored: Partial<LayoutPreference> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") ?? {};
  } catch {
    stored = {};
  }
  return {
    sidebarCollapsed: typeof stored.sidebarCollapsed === "boolean"
      ? stored.sidebarCollapsed
      : localStorage.getItem(LEGACY_COLLAPSED_KEY) === "1",
    sidebarWidth: width(stored.sidebarWidth, SIDEBAR_WIDTH),
    inspectorWidth: width(stored.inspectorWidth, INSPECTOR_WIDTH),
  };
}

export function useLayoutPreference() {
  const [layout, setLayout] = useState(initialLayoutPreference);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    localStorage.removeItem(LEGACY_COLLAPSED_KEY);
  }, [layout]);

  return [layout, setLayout] as const;
}
