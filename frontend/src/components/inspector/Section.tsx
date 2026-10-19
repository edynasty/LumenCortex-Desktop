import type { ReactNode } from "react";

/*
 * A Demo "Lumen Glass" pane section (demo/panel/Section.tsx): a quiet heading row — title, an
 * optional badge, an optional action pinned to the right edge — then content separated from its
 * neighbours by spacing, not boxes.
 */
export function InspectorSection({
  title,
  badge,
  action,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tp-pane-section">
      <header className="tp-pane-section-head">
        <h4>{title}</h4>
        {badge}
        <span className="toolbar-spacer" />
        {action}
      </header>
      {children}
    </section>
  );
}

/** A label · value row, mono for paths, ids and sizes. */
export function InspectorRow({ label, mono, children }: { label: ReactNode; mono?: boolean; children: ReactNode }) {
  return (
    <div className="tp-pane-row">
      <span className="tp-pane-label">{label}</span>
      <span className={`tp-pane-value ${mono ? "mono" : ""}`}>{children}</span>
    </div>
  );
}
