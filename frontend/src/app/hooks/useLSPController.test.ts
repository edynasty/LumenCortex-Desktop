import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLSPController } from "./useLSPController";

const mocks = vi.hoisted(() => ({
  lspStatus: vi.fn(),
  startLSP: vi.fn(),
  stopLSP: vi.fn(),
  lspDiagnostics: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

describe("useLSPController", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.lspStatus.mockReset();
    mocks.startLSP.mockReset();
    mocks.stopLSP.mockReset();
    mocks.lspDiagnostics.mockReset();
    mocks.lspStatus.mockResolvedValue({
      running: true,
      pid: 42,
      pendingRequests: 0,
      diagnostics: 1,
    });
  });

  it("loads session LSP status and starts with parsed arguments", async () => {
    const setBusy = vi.fn();
    const setError = vi.fn();
    mocks.startLSP.mockResolvedValue({
      running: true,
      pid: 99,
      pendingRequests: 0,
      diagnostics: 0,
    });

    const { result } = renderHook(() => useLSPController({
      workspace: "/repo",
      selectedSessionId: "session-1",
      busy: false,
      setBusy,
      setError,
    }));

    await waitFor(() => expect(mocks.lspStatus).toHaveBeenCalledWith("session-1"));

    act(() => {
      result.current.setCommand("typescript-language-server");
      result.current.setArgs('--stdio --log-level "4 verbose"');
      result.current.setLanguage("typescript");
    });

    await act(async () => {
      await result.current.start();
    });

    expect(mocks.startLSP).toHaveBeenCalledWith("session-1", {
      name: "typescript-language-server",
      command: "typescript-language-server",
      args: ["--stdio", "--log-level", "4 verbose"],
      languageId: "typescript",
    });
    expect(setBusy).toHaveBeenNthCalledWith(1, true);
    expect(setBusy).toHaveBeenLastCalledWith(false);
  });

  it("refreshes diagnostics only for an active server and file", async () => {
    const setBusy = vi.fn();
    const setError = vi.fn();
    mocks.lspDiagnostics.mockResolvedValue([{
      range: {
        start: { line: 1, character: 2 },
        end: { line: 1, character: 4 },
      },
      severity: 2,
      message: "warning",
    }]);

    const { result } = renderHook(() => useLSPController({
      workspace: "/repo",
      selectedSessionId: "session-2",
      busy: false,
      setBusy,
      setError,
    }));

    await waitFor(() => expect(result.current.status.running).toBe(true));

    act(() => result.current.setDiagnosticPath("src/main.ts"));
    await act(async () => {
      await result.current.refreshDiagnostics();
    });

    expect(mocks.lspDiagnostics).toHaveBeenCalledWith("session-2", "src/main.ts");
    expect(result.current.diagnostics).toHaveLength(1);
    expect(setError).toHaveBeenCalledWith("");
  });
});
