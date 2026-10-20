import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentCatalog } from "./useAgentCatalog";
import type { AgentCatalog, AgentEntry } from "../../types";

const mocks = vi.hoisted(() => ({ agents: vi.fn(), saveAgent: vi.fn(), deleteAgent: vi.fn() }));
vi.mock("../../lib/bridge", () => ({
  bridge: { agents: mocks.agents, saveAgent: mocks.saveAgent, deleteAgent: mocks.deleteAgent },
}));

function entry(overrides: Partial<AgentEntry> & { id: string }): AgentEntry {
  return {
    name: overrides.id, use: "conversation", policy: "full", delegation: "isolated", instructions: "",
    models: null, builtin: false, source: "global", digest: `sha256:${overrides.id}`,
    forConversation: true, editable: true, ...overrides,
  };
}

const catalog = (agents: AgentEntry[]): AgentCatalog => ({
  agents,
  limits: { maxCustom: 16, name: 40, description: 280, instructions: 16 << 10, models: 8, idPattern: "^[a-z][a-z0-9-]{0,39}$" },
  globalPath: "/home/lumencortex.json",
  globalDigest: "sha256:g",
});

const agents = [
  entry({ id: "ask", name: "Ask", policy: "read-only", delegation: "none", builtin: true, source: "builtin" }),
  entry({ id: "agent", name: "Agent", builtin: true, source: "builtin" }),
  entry({ id: "explore", name: "Explore", use: "delegation", forConversation: false, builtin: true, source: "builtin" }),
  entry({ id: "reviewer", name: "Code reviewer" }),
];

describe("useAgentCatalog", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.agents.mockReset();
    mocks.saveAgent.mockReset();
    mocks.deleteAgent.mockReset();
  });

  it("starts on the four built-ins and replaces them with Core's catalog", async () => {
    mocks.agents.mockResolvedValue(catalog(agents));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "" }));
    expect(result.current.agents.map((agent) => agent.id)).toEqual(["ask", "agent", "explore", "worker"]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents.map((agent) => agent.id)).toEqual(["ask", "agent", "explore", "reviewer"]);
    // The composer only offers agents that may run a conversation.
    expect(result.current.composerAgent.agents.map((agent) => agent.id)).toEqual(["ask", "agent", "reviewer"]);
  });

  it("falls back to Agent when the stored id is gone or delegation-only", async () => {
    mocks.agents.mockResolvedValue(catalog(agents));
    localStorage.setItem("lcx-composer", JSON.stringify({ agentId: "explore" }));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agentId).toBe("agent");
    expect(JSON.parse(localStorage.getItem("lcx-composer") || "{}").agentId).toBe("agent");
  });

  it("shows a thread's pinned agent and lets a pick replace it without sending a model", async () => {
    mocks.agents.mockResolvedValue(catalog(agents));
    const onAgentSelected = vi.fn();
    const { result, rerender } = renderHook(
      ({ sessionId, pinnedAgent }) => useAgentCatalog({ sessionId, pinnedAgent, onAgentSelected }),
      { initialProps: { sessionId: "s1", pinnedAgent: "ask" } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agentId).toBe("ask");

    act(() => result.current.select("reviewer"));
    expect(result.current.agentId).toBe("reviewer");
    expect(onAgentSelected).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("lcx-composer") || "{}").agentId).toBe("reviewer");

    // The pin has not moved yet (the turn has not run): the pick survives a re-render.
    rerender({ sessionId: "s1", pinnedAgent: "ask" });
    expect(result.current.agentId).toBe("reviewer");

    // After the turn, Core reports the new pin, which the composer adopts.
    rerender({ sessionId: "s1", pinnedAgent: "reviewer" });
    expect(result.current.agentId).toBe("reviewer");

    // Another thread brings its own pin.
    rerender({ sessionId: "s2", pinnedAgent: "ask" });
    expect(result.current.agentId).toBe("ask");
  });

  it("saves and deletes through the bridge with the digest it read", async () => {
    mocks.agents.mockResolvedValue(catalog(agents));
    const saved = catalog([...agents, entry({ id: "planner", name: "Planner" })]);
    mocks.saveAgent.mockResolvedValue(saved);
    mocks.deleteAgent.mockResolvedValue(catalog(agents));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.save(entry({ id: "", name: "Planner" })); });
    expect(mocks.saveAgent).toHaveBeenCalledWith("sha256:g", expect.objectContaining({ name: "Planner" }));
    expect(result.current.agents.map((agent) => agent.id)).toContain("planner");

    await act(async () => { await result.current.remove("planner"); });
    expect(mocks.deleteAgent).toHaveBeenCalledWith("sha256:g", "planner");
  });

  it("keeps the built-ins when Core cannot be reached", async () => {
    mocks.agents.mockRejectedValue(new Error("Wails bridge is not available"));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents).toHaveLength(4);
    expect(result.current.agentId).toBe("agent");
  });
});
