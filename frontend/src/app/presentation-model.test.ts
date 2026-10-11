import { describe, expect, it } from "vitest";
import { buildSidebarGroups, providerModelOptions } from "./presentation-model";
import type { Session } from "../types";

const labels = {
  active: "Active",
  created: "Created",
  completed: "Completed",
  interrupted: "Interrupted",
  failed: "Failed",
  waiting: "Waiting",
  runningElsewhere: "Running elsewhere",
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
    }, {
      demo: { configured: true, available: false },
    });

    expect(options).toEqual([{
      ref: "demo/coder",
      label: "Coder",
      group: "Demo",
      description: "upstream-coder · 64K ctx · 8K out",
      isDefault: true,
      missingSecret: true,
    }]);
  });

  it("groups top-level threads by runtime attention and UI metadata", () => {
    const sessions = [
      session("active", "running"),
      session("orphan-running", "running"),
      session("waiting", "waiting_gate"),
      session("failed", "failed"),
      { ...session("stale-error", "completed"), error: { kind: "storage", message: "left over" } },
      session("interrupted", "interrupted"),
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
      ["running", ["active", "orphan-running"]],
      ["attention", ["waiting", "failed", "interrupted"]],
      ["pinned", ["pinned"]],
      ["recent", ["stale-error", "recent"]],
      ["archived", ["archived"]],
    ]);

    const [running, elsewhere] = groups[0].sessions;
    expect(running.statusLabel).toBe("Active");
    // Durably running but not run by this process: shown as such, never rewritten as interrupted.
    expect(elsewhere).toMatchObject({ statusLabel: "Running elsewhere", attentionTone: undefined, active: false });
    const attention = groups[1].sessions;
    expect(attention[0]).toMatchObject({ statusLabel: "Waiting", attentionTone: "warning" });
    expect(attention[1]).toMatchObject({ statusLabel: "Failed", attentionTone: "danger" });
    expect(attention[2]).toMatchObject({ statusLabel: "Interrupted", attentionTone: "danger" });
    // error_json presence does not decide the label: a completed session stays Completed.
    expect(groups[3].sessions[0]).toMatchObject({ statusLabel: "Completed", attentionTone: undefined });
    expect(groups[2].sessions[0].title).toBe("Pinned title");
  });
});
