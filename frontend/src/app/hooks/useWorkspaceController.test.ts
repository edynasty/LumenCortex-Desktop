import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceController } from "./useWorkspaceController";
import type { ProviderCatalog } from "../../types";

const mocks = vi.hoisted(() => ({
  state: vi.fn(),
  providerCatalog: vi.fn(),
  providerSecretStatuses: vi.fn(),
  pickWorkspace: vi.fn(),
  openWorkspace: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

const catalogA: ProviderCatalog = {
  model: "alpha/main",
  providers: {
    alpha: {
      name: "Alpha",
      models: {
        main: { name: "Main" },
      },
    },
  },
};

const catalogB: ProviderCatalog = {
  model: "beta/code",
  providers: {
    beta: {
      name: "Beta",
      models: {
        code: { name: "Code" },
      },
    },
  },
};

describe("useWorkspaceController", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.state.mockReset();
    mocks.providerCatalog.mockReset();
    mocks.providerSecretStatuses.mockReset();
    mocks.providerSecretStatuses.mockResolvedValue({});
    mocks.pickWorkspace.mockReset();
    mocks.openWorkspace.mockReset();
  });

  it("tracks recent projects and resets an invalid model on workspace change", async () => {
    let activeCatalog = catalogA;
    mocks.state.mockResolvedValue({
      workspace: "/repo-a",
      sessions: [],
      activeRuns: [],
    });
    mocks.providerCatalog.mockImplementation(async () => activeCatalog);
    mocks.providerSecretStatuses.mockResolvedValue({
      alpha: { configured: true, available: true },
      beta: { configured: true, available: false },
    });
    mocks.openWorkspace.mockResolvedValue({
      workspace: "/repo-b",
      sessions: [],
      activeRuns: [],
    });

    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));

    await waitFor(() => expect(result.current.state.workspace).toBe("/repo-a"));
    await waitFor(() => expect(result.current.modelRef).toBe("alpha/main"));
    await waitFor(() => expect(result.current.providerSecretStatuses.alpha?.available).toBe(true));
    await waitFor(() => expect(result.current.recentProjects[0]).toBe("/repo-a"));

    activeCatalog = catalogB;
    let opened = false;
    await act(async () => {
      opened = await result.current.openWorkspace("/repo-b");
    });

    expect(opened).toBe(true);
    await waitFor(() => expect(result.current.state.workspace).toBe("/repo-b"));
    await waitFor(() => expect(result.current.modelRef).toBe("beta/code"));
    await waitFor(() => expect(result.current.providerSecretStatuses.beta?.available).toBe(false));
    await waitFor(() => expect(result.current.recentProjects[0]).toBe("/repo-b"));
    expect(result.current.recentProjects).toContain("/repo-a");
  });

  it("returns false and reports workspace open errors", async () => {
    mocks.state.mockResolvedValue({
      workspace: "",
      sessions: [],
      activeRuns: [],
    });
    mocks.providerCatalog.mockResolvedValue({ providers: {} });
    mocks.openWorkspace.mockRejectedValue(new Error("cannot open"));

    const setError = vi.fn();
    const { result } = renderHook(() => useWorkspaceController({ setError }));

    let opened = true;
    await act(async () => {
      opened = await result.current.openWorkspace("/missing");
    });

    expect(opened).toBe(false);
    expect(setError).toHaveBeenCalledWith("Error: cannot open");
  });
});
