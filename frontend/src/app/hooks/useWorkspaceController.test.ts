import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceController } from "./useWorkspaceController";
import type { ConfigState } from "../../types";

const mocks = vi.hoisted(() => ({
  state: vi.fn(),
  configState: vi.fn(),
  trustWorkspace: vi.fn(),
  pickWorkspace: vi.fn(),
  openWorkspace: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

function configFor(workspace: string, model: string, overrides: Partial<ConfigState> = {}): ConfigState {
  return {
    workspace,
    trusted: false,
    model,
    failover: [],
    models: [],
    warnings: [],
    globalPath: "/home/.config/lumencortex/lumencortex.json",
    globalDigest: "sha256:one",
    ...overrides,
  };
}

const emptyState = { workspace: "", sessions: [], activeRuns: [] };

describe("useWorkspaceController", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("tracks recent projects and reloads Core's configuration when the workspace changes", async () => {
    mocks.state.mockResolvedValue({ ...emptyState, workspace: "/repo-a" });
    mocks.configState.mockImplementation(async () => configFor("/repo-a", "alpha/main"));
    mocks.openWorkspace.mockResolvedValue({ ...emptyState, workspace: "/repo-b" });

    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));

    await waitFor(() => expect(result.current.config.model).toBe("alpha/main"));
    await waitFor(() => expect(result.current.recentProjects[0]).toBe("/repo-a"));

    mocks.configState.mockImplementation(async () => configFor("/repo-b", "beta/code"));
    let opened = false;
    await act(async () => {
      opened = await result.current.openWorkspace("/repo-b");
    });

    expect(opened).toBe(true);
    await waitFor(() => expect(result.current.config.model).toBe("beta/code"));
    expect(result.current.recentProjects[0]).toBe("/repo-b");
    expect(result.current.recentProjects).toContain("/repo-a");
    expect(result.current.opening).toBe(false);
  });

  it("is busy while a project opens and reports the open error", async () => {
    mocks.state.mockResolvedValue(emptyState);
    mocks.configState.mockResolvedValue(configFor("", ""));
    const pending = Promise.withResolvers<never>();
    mocks.openWorkspace.mockReturnValue(pending.promise);

    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));

    let opened: Promise<boolean> = Promise.resolve(true);
    act(() => {
      opened = result.current.openWorkspace("/locked");
    });
    expect(result.current.opening).toBe(true);

    await act(async () => {
      pending.reject(new Error("database is open in another process; close it to change the schema"));
      expect(await opened).toBe(false);
    });

    expect(result.current.opening).toBe(false);
    expect(setError).toHaveBeenLastCalledWith("Error: database is open in another process; close it to change the schema");
  });

  it("trusts the workspace with the digest it last read", async () => {
    mocks.state.mockResolvedValue({ ...emptyState, workspace: "/repo" });
    mocks.configState.mockResolvedValue(configFor("/repo", "a/b"));
    mocks.trustWorkspace.mockResolvedValue(configFor("/repo", "a/b", { trusted: true, globalDigest: "sha256:two" }));

    const setError = vi.fn(); // stable, like the state setter App passes
    const { result } = renderHook(() => useWorkspaceController({ setError }));
    await waitFor(() => expect(result.current.state.workspace).toBe("/repo"));
    await waitFor(() => expect(result.current.config.globalDigest).toBe("sha256:one"));
    await act(async () => undefined);

    await act(async () => {
      await result.current.trustWorkspace();
    });

    expect(mocks.trustWorkspace).toHaveBeenCalledWith("sha256:one");
    expect(result.current.config.trusted).toBe(true);
    expect(result.current.config.globalDigest).toBe("sha256:two");
  });

  it("refreshes the configuration and reports a conflict when the global file changed", async () => {
    mocks.state.mockResolvedValue({ ...emptyState, workspace: "/repo" });
    mocks.configState.mockResolvedValue(configFor("/repo", "a/b"));
    mocks.trustWorkspace.mockRejectedValue(new Error("config file changed since it was read: /home/lumencortex.json"));

    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));
    await waitFor(() => expect(result.current.config.globalDigest).toBe("sha256:one"));

    mocks.configState.mockResolvedValue(configFor("/repo", "a/b", { globalDigest: "sha256:newer" }));
    await act(async () => {
      await result.current.trustWorkspace();
    });

    expect(result.current.config.globalDigest).toBe("sha256:newer");
    expect(result.current.config.trusted).toBe(false);
    expect(setError).toHaveBeenLastCalledWith(expect.stringContaining("config file changed since it was read"));
    expect(result.current.trusting).toBe(false);
  });

  // The file can change in an editor or the CLI while the app is in the background; the picker
  // must not keep showing a default Core no longer uses for a new task.
  it("reopens the project the user last worked in when the app starts without one", async () => {
    localStorage.setItem("lcx-recent-projects", JSON.stringify(["/last", "/older"]));
    mocks.state.mockResolvedValue(emptyState);
    mocks.configState.mockResolvedValue(configFor("", "alpha/main"));
    mocks.openWorkspace.mockResolvedValue({ ...emptyState, workspace: "/last" });
    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));
    await waitFor(() => expect(result.current.state.workspace).toBe("/last"));
    expect(mocks.openWorkspace).toHaveBeenCalledWith("/last");
    expect(result.current.opening).toBe(false);
  });

  it("stays on the welcome screen without an error when the last project cannot be opened", async () => {
    localStorage.setItem("lcx-recent-projects", JSON.stringify(["/gone"]));
    mocks.state.mockResolvedValue(emptyState);
    mocks.configState.mockResolvedValue(configFor("", "alpha/main"));
    mocks.openWorkspace.mockRejectedValue(new Error("no such directory"));
    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));
    await waitFor(() => expect(mocks.openWorkspace).toHaveBeenCalledWith("/gone"));
    await waitFor(() => expect(result.current.opening).toBe(false));
    expect(result.current.state.workspace).toBe("");
    expect(setError).not.toHaveBeenCalled();
  });

  it("does not reopen anything when the backend already has a project", async () => {
    localStorage.setItem("lcx-recent-projects", JSON.stringify(["/last"]));
    mocks.state.mockResolvedValue({ ...emptyState, workspace: "/open" });
    mocks.configState.mockResolvedValue(configFor("/open", "alpha/main"));
    const { result } = renderHook(() => useWorkspaceController({ setError: vi.fn() }));
    await waitFor(() => expect(result.current.state.workspace).toBe("/open"));
    expect(mocks.openWorkspace).not.toHaveBeenCalled();
  });

  it("reloads Core's configuration when the window regains focus", async () => {
    mocks.state.mockResolvedValue({ ...emptyState, workspace: "/repo" });
    mocks.configState.mockResolvedValue(configFor("/repo", "alpha/main"));
    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));
    await waitFor(() => expect(result.current.config.model).toBe("alpha/main"));

    mocks.configState.mockResolvedValue(configFor("/repo", "beta/code"));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current.config.model).toBe("beta/code"));
  });

  it("never lets an older configuration response replace a newer one", async () => {
    // Core answers with whatever is current; only the focus read below is held back. Mount reads
    // twice (before and after the workspace is known), so a one-shot mock would run dry. setError
    // must be stable, as React's setter is in the app; a new function per render would re-read on
    // every render and hide a stale response.
    let current = configFor("/repo-a", "alpha/main");
    mocks.state.mockResolvedValue({ ...emptyState, workspace: "/repo-a" });
    mocks.configState.mockImplementation(async () => current);
    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));
    await waitFor(() => expect(result.current.recentProjects[0]).toBe("/repo-a"));
    await waitFor(() => expect(result.current.config.model).toBe("alpha/main"));

    // A focus refresh still reads project A when project B opens and is read.
    const slow = Promise.withResolvers<ConfigState>();
    mocks.configState.mockImplementationOnce(() => slow.promise);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    current = configFor("/repo-b", "beta/code");
    mocks.openWorkspace.mockResolvedValue({ ...emptyState, workspace: "/repo-b" });
    await act(async () => {
      await result.current.openWorkspace("/repo-b");
    });
    await waitFor(() => expect(result.current.config.model).toBe("beta/code"));

    await act(async () => {
      slow.resolve(configFor("/repo-a", "alpha/main"));
      await slow.promise;
    });
    expect(result.current.config.workspace).toBe("/repo-b");
    expect(result.current.config.model).toBe("beta/code");
  });
});
