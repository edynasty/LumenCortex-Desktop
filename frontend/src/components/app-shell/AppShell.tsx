import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  closeLabel: string;
  onCloseSidebar: () => void;
};

export function AppShell({
  sidebar,
  children,
  inspector,
  sidebarOpen,
  sidebarCollapsed,
  inspectorOpen,
  closeLabel,
  onCloseSidebar,
}: Props) {
  const closeSidebarRef = useRef(onCloseSidebar);

  useEffect(() => {
    closeSidebarRef.current = onCloseSidebar;
  }, [onCloseSidebar]);

  useLayoutEffect(() => {
    if (!sidebarOpen) return;

    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => {
      const sidebarElement = document.querySelector<HTMLElement>(".sidebar.open");
      return Array.from(
        sidebarElement?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((element) =>
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden"
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSidebarRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const sidebarElement = document.querySelector<HTMLElement>(".sidebar.open");
      if (!sidebarElement?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [sidebarOpen]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {sidebar}
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={onCloseSidebar}
          aria-label={closeLabel}
        />
      )}

      <section className={`workspace-shell ${inspectorOpen ? "with-inspector" : ""}`}>
        <main className="workspace-main">{children}</main>
        {inspectorOpen ? inspector : null}
      </section>
    </div>
  );
}
