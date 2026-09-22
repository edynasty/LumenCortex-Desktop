import { useEffect, type ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  closeLabel: string;
  onCloseSidebar: () => void;
};

export function AppShell({
  sidebar,
  children,
  inspector,
  sidebarOpen,
  inspectorOpen,
  closeLabel,
  onCloseSidebar,
}: Props) {
  useEffect(() => {
    if (!sidebarOpen) return;

    const previous = document.activeElement as HTMLElement | null;
    const sidebarElement = document.querySelector<HTMLElement>(".sidebar.open");
    const focusable = () =>
      Array.from(
        sidebarElement?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      );

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseSidebar();
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
      if (event.shiftKey && document.activeElement === first) {
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
      requestAnimationFrame(() => previous?.focus());
    };
  }, [onCloseSidebar, sidebarOpen]);

  return (
    <div className="app-shell">
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
