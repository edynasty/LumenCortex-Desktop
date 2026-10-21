import { describe, expect, it } from "vitest";
import type { SidebarGroup } from "../components/sidebar/Sidebar";
import { runAnnouncement, runSnapshot } from "./run-announcement";

function groups(...threads: Array<[string, string, boolean]>): SidebarGroup[] {
  return [{
    key: "recent", label: "Recent",
    sessions: threads.map(([id, status, active]) => ({
      session: { id, status },
      title: `Thread ${id}`,
      active,
      statusLabel: active ? "Running" : status === "waiting_gate" ? "Waiting for approval" : status === "completed" ? "Turn ended" : status,
    })) as unknown as SidebarGroup["sessions"],
  }];
}
const snap = (...threads: Array<[string, string, boolean]>) => runSnapshot(groups(...threads));

describe("runAnnouncement", () => {
  it("says nothing for the first snapshot", () => {
    expect(runAnnouncement(undefined, snap(["a", "running", true]))).toBe("");
  });

  it("announces start, gate and end of a turn as '<title>: <status>'", () => {
    const idle = snap(["a", "completed", false]);
    const started = snap(["a", "running", true]);
    const gated = snap(["a", "waiting_gate", false]);
    const ended = snap(["a", "completed", false]);
    expect(runAnnouncement(idle, started)).toBe("Thread a: Running");
    expect(runAnnouncement(started, gated)).toBe("Thread a: Waiting for approval");
    expect(runAnnouncement(gated, started)).toBe("Thread a: Running");
    expect(runAnnouncement(started, ended)).toBe("Thread a: Turn ended");
  });

  it("stays quiet when nothing changed, for a thread that only appears, and for non-events", () => {
    const before = snap(["a", "completed", false]);
    expect(runAnnouncement(before, snap(["a", "completed", false]))).toBe("");
    expect(runAnnouncement(before, snap(["a", "completed", false], ["b", "failed", false]))).toBe("");
    expect(runAnnouncement(snap(["a", "running", true]), snap(["a", "created", false]))).toBe("");
  });

  it("joins simultaneous transitions", () => {
    const before = snap(["a", "running", true], ["b", "running", true]);
    const after = snap(["a", "failed", false], ["b", "completed", false]);
    expect(runAnnouncement(before, after)).toBe("Thread a: failed; Thread b: Turn ended");
  });
});
