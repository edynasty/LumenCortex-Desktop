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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "b" ||
        (!event.metaKey && !event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        !window.matchMedia("(min-width: 821px)").matches
      ) {
        return;
      }
      event.preventDefault();
      setCollapsed((current) => !current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return [collapsed, setCollapsed] as const;
}
