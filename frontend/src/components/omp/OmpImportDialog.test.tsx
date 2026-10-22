import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { OMPImportPreview, OMPSessionSummary } from "../../types";
import { OmpImportDialog } from "./OmpImportDialog";

const mocks = vi.hoisted(() => ({
  ompSessions: vi.fn(),
  previewOMPSession: vi.fn(),
  importOMPSession: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels = copy.en;

const session: OMPSessionSummary = {
  path: "/home/.omp/agent/sessions/-work/2026-10-01T08-00-00-000Z_01a10000-0000-7000-8000-000000000001.jsonl",
  id: "01a10000-0000-7000-8000-000000000001",
  title: "Fix the parser bug",
  cwd: "/work",
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
  size: 2048,
  children: 2,
  workspaceMatch: true,
};

function preview(patch: Partial<OMPImportPreview> = {}): OMPImportPreview {
  return {
    source: session,
    sessionId: "session-imported",
    goal: "Fix the parser bug",
    model: "prov/model-a",
    firstUser: "Fix the parser bug in src/parse.go.",
    lastAssistant: "Fixed the off-by-one; tests pass.",
    stats: {
      rows: 11, userMessages: 2, assistantMessages: 2, toolCalls: 3, toolResults: 3,
      notices: 1, markers: 1, thinkingBlocks: 4, hiddenMessages: 2, retriedTurns: 1,
      images: 1, compactions: 1, branchReturns: 0, interruptedCalls: 1,
      orphanResults: 0, duplicateCalls: 0, truncatedRows: 0,
    },
    offBranch: 1,
    malformed: 0,
    children: [
      { key: "Scout1", sessionId: "session-child", agent: "scout", goal: "Scout1 (scout)", rows: 4 },
      { key: "Killed", sessionId: "session-killed", agent: "scout", goal: "Killed (scout)", rows: 2, aborted: true },
    ],
    sha256: "sha256:abc",
    warnings: [{ code: "open_tool_calls", message: "Core's English explanation." }],
    ...patch,
  };
}

function renderDialog(onImported = vi.fn(), onClose = vi.fn()) {
  render(<OmpImportDialog open labels={labels} locale="en" onClose={onClose} onImported={onImported} />);
  return { onImported, onClose };
}

describe("OmpImportDialog", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
    mocks.ompSessions.mockResolvedValue([session]);
  });

  it("lists this workspace's sessions, previews the chosen one and imports it", async () => {
    const user = userEvent.setup();
    mocks.previewOMPSession.mockResolvedValue(preview());
    mocks.importOMPSession.mockResolvedValue({
      sessionId: "session-imported", alreadyImported: false, sourceChanged: false, sessions: 3, preview: preview(),
    });
    const { onImported } = renderDialog();

    await user.click(await screen.findByRole("button", { name: /Fix the parser bug/ }));
    expect(await screen.findByText("Fix the parser bug in src/parse.go.")).toBeInTheDocument();
    expect(screen.getByText("Fixed the off-by-one; tests pass.")).toBeInTheDocument();
    expect(screen.getByText(labels.ompImportSafety)).toBeInTheDocument();
    expect(mocks.ompSessions).toHaveBeenCalledWith({ all: false, query: "", limit: 100 });

    await user.click(screen.getByRole("button", { name: labels.ompImportAction }));
    expect(mocks.importOMPSession).toHaveBeenCalledWith(session.path);
    await waitFor(() => expect(onImported).toHaveBeenCalledWith("session-imported"));
  });

  it("turns the button into Open for a session imported before and never imports it again", async () => {
    const user = userEvent.setup();
    const imported = { ...session, imported: { sessionId: "session-existing", importedAt: "2026-10-02T00:00:00Z", sourceChanged: true } };
    mocks.ompSessions.mockResolvedValue([imported]);
    mocks.previewOMPSession.mockResolvedValue(preview({ source: imported }));
    const { onImported } = renderDialog();

    await user.click(await screen.findByRole("button", { name: /Fix the parser bug/ }));
    expect(await screen.findByText(labels.ompImportImportedHint)).toBeInTheDocument();
    expect(screen.getByText(labels.ompImportSourceChanged)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: labels.ompImportOpen }));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith("session-existing"));
    expect(mocks.importOMPSession).not.toHaveBeenCalled();
  });

  it("localizes known warning codes and falls back to Core's message for an unknown one", async () => {
    const user = userEvent.setup();
    mocks.previewOMPSession.mockResolvedValue(preview({
      warnings: [
        { code: "workspace_mismatch", message: "ran elsewhere" },
        { code: "future_code", message: "Core explains this in English." },
      ],
    }));
    renderDialog();

    await user.click(await screen.findByRole("button", { name: /Fix the parser bug/ }));
    expect(await screen.findByText(labels.ompWarnWorkspaceMismatch)).toBeInTheDocument();
    expect(screen.getByText("Core explains this in English.")).toBeInTheDocument();
  });

  it("asks for every workspace when the scope changes and keeps the search", async () => {
    const user = userEvent.setup();
    mocks.previewOMPSession.mockResolvedValue(preview());
    renderDialog();

    await user.click(screen.getByRole("radio", { name: labels.ompImportAllWorkspaces }));
    await waitFor(() => expect(mocks.ompSessions).toHaveBeenLastCalledWith({ all: true, query: "", limit: 100 }));

    await user.type(screen.getByRole("textbox", { name: labels.ompImportSearch }), "parser");
    await waitFor(() => expect(mocks.ompSessions).toHaveBeenLastCalledWith({ all: true, query: "parser", limit: 100 }));
  });

  it("shows Core's list failure inline", async () => {
    mocks.ompSessions.mockRejectedValue("OMP directory is not readable");
    renderDialog();

    expect(await screen.findByText(labels.ompImportListError)).toBeInTheDocument();
    expect(screen.getByText("OMP directory is not readable")).toBeInTheDocument();
  });
});
