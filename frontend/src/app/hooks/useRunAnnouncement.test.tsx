import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarGroup } from "../../components/sidebar/Sidebar";
import { useRunAnnouncement } from "./useRunAnnouncement";

function groups(...threads: Array<[string, string, boolean]>): SidebarGroup[] {
  return [{
    key: "recent", label: "Recent",
    sessions: threads.map(([id, status, active]) => ({
      session: { id, status }, title: "Same title", active, statusLabel: active ? "Running" : "Turn ended",
    })) as unknown as SidebarGroup["sessions"],
  }];
}

describe("useRunAnnouncement", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("speaks a repeat of the same text again and gives each occurrence its own clear window", () => {
    const { result, rerender } = renderHook(({ g }) => useRunAnnouncement(g), {
      initialProps: { g: groups(["a", "running", true], ["b", "running", true]) },
    });
    expect(result.current).toBe("");

    rerender({ g: groups(["a", "completed", false], ["b", "running", true]) });
    const first = result.current;
    expect(first.replace("\u200b", "")).toBe("Same title: Turn ended");

    act(() => { vi.advanceTimersByTime(3000); });
    rerender({ g: groups(["a", "completed", false], ["b", "completed", false]) });
    // Same words, different DOM text: the live region speaks it again.
    expect(result.current.replace("\u200b", "")).toBe("Same title: Turn ended");
    expect(result.current).not.toBe(first);

    // The first occurrence's timer (1 s left) must not clear the second one early.
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current).not.toBe("");
    act(() => { vi.advanceTimersByTime(2600); });
    expect(result.current).toBe("");
  });
});
