import { useEffect, useState } from "react";

const STORAGE_KEY = "lcx-sidebar-collapsed";

export function initialSidebarCollapsed() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function useSidebarCollapsedPreference() {
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return [collapsed, setCollapsed] as const;
}
