import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SubagentNode } from "../../types";
import { SubagentTreePanel } from "./SubagentTreePanel";

const labels = {
  title: "Subagents",
  empty: "No subagents",
  active: "Running",
  completed: "Run finished",
  interrupted: "Interrupted",
  imported: "Imported history",
};

function node(overrides: Partial<SubagentNode> = {}): SubagentNode {
  return {
    sessionId: "child-1",
    parentSessionId: "parent-1",
    kind: "subagent",
    mode: "imported",
    goal: "Scout1 (scout)",
    status: "completed",
    active: false,
    createdAt: "2026-10-22T00:00:00Z",
    updatedAt: "2026-10-22T00:00:00Z",
    runtime: { kind: "local", path: "/tmp/workspace" },
    ...overrides,
  };
}

describe("SubagentTreePanel", () => {
  it("labels an imported OMP child separately from its execution status", () => {
    render(<SubagentTreePanel nodes={[node()]} labels={labels} onOpenSession={vi.fn()} />);
    expect(screen.getByText("Imported history · Run finished")).toBeInTheDocument();
  });

  it("does not label a native child as imported", () => {
    render(<SubagentTreePanel nodes={[node({ mode: "read-only" })]} labels={labels} onOpenSession={vi.fn()} />);
    expect(screen.getByText("Run finished")).toBeInTheDocument();
    expect(screen.queryByText("Imported history · Run finished")).not.toBeInTheDocument();
  });

  it("opens the selected child session", () => {
    const onOpenSession = vi.fn();
    render(<SubagentTreePanel nodes={[node()]} labels={labels} onOpenSession={onOpenSession} />);
    fireEvent.click(screen.getByRole("button", { name: /Scout1/ }));
    expect(onOpenSession).toHaveBeenCalledWith("child-1");
  });
});
