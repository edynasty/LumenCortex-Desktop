import type { SidebarGroup } from "../components/sidebar/Sidebar";

/** One thread's announceable state: "active" while this process runs it, else the durable status. */
export type RunSnapshot = Map<string, { state: string; title: string; label: string }>;

// Run started (active), waiting at a gate, and the three ways a turn ends. Other transitions
// (created, running elsewhere, unknown) are not events the user needs spoken.
const announced = new Set(["active", "waiting_gate", "completed", "failed", "interrupted"]);

export function runSnapshot(groups: SidebarGroup[]): RunSnapshot {
  const snapshot: RunSnapshot = new Map();
  for (const group of groups) {
    for (const thread of group.sessions) {
      snapshot.set(thread.session.id, {
        state: thread.active ? "active" : thread.session.status,
        title: thread.title,
        label: thread.statusLabel,
      });
    }
  }
  return snapshot;
}

/**
 * What the shell's polite live region says after the thread list changed: "<title>: <status>" for
 * every thread that entered an announceable state. The first snapshot is the baseline, not news,
 * and a thread that appears already finished (loaded, not run) is not announced.
 */
export function runAnnouncement(previous: RunSnapshot | undefined, next: RunSnapshot): string {
  if (!previous) return "";
  const lines: string[] = [];
  for (const [id, thread] of next) {
    const before = previous.get(id);
    if (!before || before.state === thread.state || !announced.has(thread.state)) continue;
    lines.push(`${thread.title}: ${thread.label}`);
  }
  return lines.join("; ");
}
