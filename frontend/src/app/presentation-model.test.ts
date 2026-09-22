import { describe, expect, it } from "vitest";
import { buildSidebarGroups, providerModelOptions } from "./presentation-model";
import type { Session } from "../types";

const labels = {
  active: "Active",
  created: "Created",
  completed: "Completed",
  interrupted: "Interrupted",
  waiting: "Waiting",
  running: "Running",
  unknown: "Unknown",
  runningThreads: "Running",
  attentionThreads: "Attention",
  pinnedThreads: "Pinned",
  recentThreads: "Recent",
  archivedThreads: "Archived",
};

function session(id: string, status: string, metadata?: Record<string, unknown>): Session {
  return {
    id,
    createdAt: "2026-09-22T03:00:00Z",
    updatedAt: "2026-09-22T03:00:00Z",
    status,
    goal: id,
    metadata,
  };
}

describe("presentation model", () => {
  it("builds provider model options with upstream ids and context metadata", () => {
    const options = providerModelOptions({
      model: "demo/coder",
      providers: {
        demo: {
          name: "Demo",
          models: {
            coder: {
              name: "Coder",
              modelID: "upstream-coder",
              limit: { context: 65536, output: 8192 },
            },
          },
        },
      },
    });

    expect(options).toEqual([{
      ref: "demo/coder",
      label: "Coder",
      group: "Demo",
      description: "upstream-coder · 64K ctx · 8K out",
      isDefault: true,
    }]);
  });

  it("groups top-level threads by runtime attention and UI metadata", () => {
    const sessions = [
      session("active", "running"),
      session("orphan-running", "running"),
      session("waiting", "waiting_gate"),
      session("pinned", "completed", { ui: { pinned: true, title: "Pinned title" } }),
      session("recent", "completed"),
      session("archived", "completed", { ui: { archived: true } }),
      session("child", "running", { subagent: { parentSessionId: "active" } }),
    ];

    const groups = buildSidebarGroups({
      sessions,
      activeRunIds: new Set(["active"]),
      workspace: "/repo",
      labels,
    });

    expect(groups.map((group) => [group.key, group.sessions.map((item) => item.session.id)])).toEqual([
      ["running", ["active"]],
      ["attention", ["orphan-running", "waiting"]],
      ["pinned", ["pinned"]],
      ["recent", ["recent"]],
      ["archived", ["archived"]],
    ]);

    const running = groups[0].sessions[0];
    expect(running.statusLabel).toBe("Active");
    const attention = groups[1].sessions[0];
    expect(attention.statusLabel).toBe("Interrupted");
    expect(groups[2].sessions[0].title).toBe("Pinned title");
  });
});
