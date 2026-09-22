import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useContextAttachments } from "./useContextAttachments";

const mocks = vi.hoisted(() => ({
  pickContextFiles: vi.fn(),
  pickContextDirectory: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

describe("useContextAttachments", () => {
  beforeEach(() => {
    mocks.pickContextFiles.mockReset();
    mocks.pickContextDirectory.mockReset();
  });

  it("merges selected context paths without duplicates and supports removal", async () => {
    mocks.pickContextFiles.mockResolvedValue(["src/App.tsx", "src/App.tsx", "internal/backend"]);
    mocks.pickContextDirectory.mockResolvedValue(["frontend"]);

    const { result } = renderHook(() => useContextAttachments({
      workspace: "/repo",
      setError: vi.fn(),
    }));

    await act(async () => {
      await result.current.pickFiles();
      await result.current.pickDirectory();
    });

    expect(result.current.paths).toEqual(["src/App.tsx", "internal/backend", "frontend"]);

    act(() => result.current.remove("internal/backend"));
    expect(result.current.paths).toEqual(["src/App.tsx", "frontend"]);

    act(() => result.current.clear());
    expect(result.current.paths).toEqual([]);
  });

  it("does not open native pickers without a workspace", async () => {
    const { result } = renderHook(() => useContextAttachments({
      workspace: "",
      setError: vi.fn(),
    }));

    await act(async () => {
      await result.current.pickFiles();
      await result.current.pickDirectory();
    });

    expect(mocks.pickContextFiles).not.toHaveBeenCalled();
    expect(mocks.pickContextDirectory).not.toHaveBeenCalled();
  });
});
