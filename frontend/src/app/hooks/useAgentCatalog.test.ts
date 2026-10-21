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
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "", workspace: "" }));
    expect(result.current.agents.map((agent) => agent.id)).toEqual(["ask", "agent", "explore", "worker"]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents.map((agent) => agent.id)).toEqual(["ask", "agent", "explore", "reviewer"]);
    // The composer only offers agents that may run a conversation.
    expect(result.current.composerAgent.agents.map((agent) => agent.id)).toEqual(["ask", "agent", "reviewer"]);
  });

  it("falls back to Agent when the stored id is gone or delegation-only", async () => {
    mocks.agents.mockResolvedValue(catalog(agents));
    localStorage.setItem("lcx-composer", JSON.stringify({ agentId: "explore" }));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "", workspace: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agentId).toBe("agent");
    expect(JSON.parse(localStorage.getItem("lcx-composer") || "{}").agentId).toBe("agent");
  });

  it("shows a thread's pinned agent and lets a pick replace it without sending a model", async () => {
    mocks.agents.mockResolvedValue(catalog(agents));
    const onAgentSelected = vi.fn();
    const { result, rerender } = renderHook(
      ({ sessionId, pinnedAgent }) => useAgentCatalog({ sessionId, pinnedAgent, workspace: "", onAgentSelected }),
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
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "", workspace: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.save(entry({ id: "", name: "Planner" })); });
    expect(mocks.saveAgent).toHaveBeenCalledWith("sha256:g", expect.objectContaining({ name: "Planner" }));
    expect(result.current.agents.map((agent) => agent.id)).toContain("planner");

    await act(async () => { await result.current.remove("planner"); });
    expect(mocks.deleteAgent).toHaveBeenCalledWith("sha256:g", "planner");
  });

  it("keeps the built-ins when Core cannot be reached", async () => {
    mocks.agents.mockRejectedValue(new Error("Wails bridge is not available"));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "", workspace: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents).toHaveLength(4);
    expect(result.current.agentId).toBe("agent");
  });

  it("keeps the remembered agent when the catalog cannot be read", async () => {
    mocks.agents.mockRejectedValue(new Error("invalid configuration: agents has a duplicate name"));
    localStorage.setItem("lcx-composer", JSON.stringify({ agentId: "reviewer" }));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "", workspace: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // The built-ins stand in for display, but the failure must not erase the user's choice.
    expect(result.current.agentId).toBe("agent");
    expect(result.current.loadError).toContain("duplicate name");
    expect(JSON.parse(localStorage.getItem("lcx-composer") || "{}").agentId).toBe("reviewer");
  });

  it("adopts a thread's pin again after visiting New task", async () => {
    mocks.agents.mockResolvedValue(catalog(agents));
    const { result, rerender } = renderHook(
      ({ sessionId, pinnedAgent }: { sessionId: string; pinnedAgent?: string }) =>
        useAgentCatalog({ sessionId, pinnedAgent, workspace: "" }),
      { initialProps: { sessionId: "s1", pinnedAgent: "ask" } as { sessionId: string; pinnedAgent?: string } },
    );
    await waitFor(() => expect(result.current.agentId).toBe("ask"));
    act(() => result.current.select("reviewer"));
    expect(result.current.agentId).toBe("reviewer");

    rerender({ sessionId: "" });
    // Reopening the same thread adopts its pin, not the pick left on New task.
    rerender({ sessionId: "s1", pinnedAgent: "ask" });
    expect(result.current.agentId).toBe("ask");
  });

  it("shows a child's pinned agent even when it cannot run a conversation", async () => {
    mocks.agents.mockResolvedValue(catalog(agents));
    localStorage.setItem("lcx-composer", JSON.stringify({ agentId: "reviewer" }));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "c1", pinnedAgent: "explore", isChild: true, workspace: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agentId).toBe("explore");
    expect(result.current.selected?.id).toBe("explore");
    expect(result.current.composerAgent.locked).toBe(true);
    expect(result.current.composerAgent.agents[0].id).toBe("explore");
    // The pin is Core's, not the user's: it neither corrects nor replaces the remembered agent.
    expect(JSON.parse(localStorage.getItem("lcx-composer") || "{}").agentId).toBe("reviewer");
  });

  it("reads the catalog again on a workspace switch and drops the previous agents", async () => {
    mocks.agents.mockResolvedValueOnce(catalog(agents));
    const { result, rerender } = renderHook(
      ({ workspace }) => useAgentCatalog({ sessionId: "", workspace }),
      { initialProps: { workspace: "/w1" } },
    );
    await waitFor(() => expect(result.current.agents.map((agent) => agent.id)).toContain("reviewer"));

    let resolveSecond: (value: AgentCatalog) => void = () => {};
    mocks.agents.mockReturnValueOnce(new Promise<AgentCatalog>((resolve) => { resolveSecond = resolve; }));
    rerender({ workspace: "/w2" });
    // The previous project's agents are neither shown nor sent while the new read is pending.
    expect(result.current.agents.map((agent) => agent.id)).toEqual(["ask", "agent", "explore", "worker"]);
    expect(result.current.agentId).toBe("agent");

    await act(async () => {
      resolveSecond(catalog(agents.filter((agent) => agent.id !== "reviewer")));
    });
    expect(mocks.agents).toHaveBeenCalledTimes(2);
    expect(result.current.agents.map((agent) => agent.id)).toEqual(["ask", "agent", "explore"]);
  });

  it("reads the catalog again after a Save conflict so the next save carries the new digest", async () => {
    mocks.agents.mockResolvedValueOnce(catalog(agents));
    const { result } = renderHook(() => useAgentCatalog({ sessionId: "", workspace: "" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const reloaded = { ...catalog(agents), globalDigest: "sha256:g2" };
    mocks.agents.mockResolvedValueOnce(reloaded);
    mocks.saveAgent.mockRejectedValueOnce(new Error("config file changed since it was read: /home/lumencortex.json"));
    await act(async () => {
      await expect(result.current.save(entry({ id: "", name: "Planner" }))).rejects.toThrow("config file changed");
    });
    expect(mocks.agents).toHaveBeenCalledTimes(2);

    mocks.saveAgent.mockResolvedValueOnce(reloaded);
    await act(async () => { await result.current.save(entry({ id: "", name: "Planner" })); });
    expect(mocks.saveAgent).toHaveBeenLastCalledWith("sha256:g2", expect.objectContaining({ name: "Planner" }));
  });
});
