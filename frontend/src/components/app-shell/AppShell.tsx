import type { ReactNode } from "react";

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
