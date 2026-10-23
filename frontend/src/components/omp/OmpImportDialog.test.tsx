import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { ImportPreview, ImportSessionSummary, ImportSource } from "../../types";
import { OmpImportDialog } from "./OmpImportDialog";

const mocks = vi.hoisted(() => ({
  importSources: vi.fn(),
  importSessions: vi.fn(),
  previewImport: vi.fn(),
  importSession: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels = copy.en;

const omp: ImportSource = { id: "omp", name: "OMP", converter: 1, defaultRoot: "/home/.omp/agent/sessions" };

const session: ImportSessionSummary = {
  source: "omp",
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

function preview(patch: Partial<ImportPreview> = {}): ImportPreview {
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

function renderDialog(onImported = vi.fn(), onClose = vi.fn(), onOpenPlugins = vi.fn(), initialSourceId?: string) {
  render(
    <OmpImportDialog
      open
      labels={labels}
      locale="en"
      initialSourceId={initialSourceId}
      onClose={onClose}
      onImported={onImported}
      onOpenPlugins={onOpenPlugins}
    />,
  );
  return { onImported, onClose, onOpenPlugins };
}

describe("OmpImportDialog", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
    mocks.importSources.mockResolvedValue([omp]);
    mocks.importSessions.mockResolvedValue([session]);
  });

  it("lists this workspace's sessions of the running source, previews one and imports it", async () => {
    const user = userEvent.setup();
    mocks.previewImport.mockResolvedValue(preview());
    mocks.importSession.mockResolvedValue({
      sessionId: "session-imported", alreadyImported: false, sourceChanged: false, sessions: 3, preview: preview(),
    });
    const { onImported } = renderDialog();

    await user.click(await screen.findByRole("button", { name: /Fix the parser bug/ }));
    expect(await screen.findByText("Fix the parser bug in src/parse.go.")).toBeInTheDocument();
    expect(screen.getByText("Fixed the off-by-one; tests pass.")).toBeInTheDocument();
    expect(screen.getByText(labels.ompImportSafety)).toBeInTheDocument();
    expect(mocks.importSessions).toHaveBeenCalledWith("omp", { all: false, query: "", limit: 100 });
    expect(mocks.previewImport).toHaveBeenCalledWith("omp", session.path);

    await user.click(screen.getByRole("button", { name: labels.ompImportAction }));
    expect(mocks.importSession).toHaveBeenCalledWith("omp", session.path);
    await waitFor(() => expect(onImported).toHaveBeenCalledWith("session-imported"));
  });

  it("turns the button into Open for a session imported before and never imports it again", async () => {
    const user = userEvent.setup();
    const imported = { ...session, imported: { sessionId: "session-existing", importedAt: "2026-10-02T00:00:00Z", sourceChanged: true } };
    mocks.importSessions.mockResolvedValue([imported]);
    mocks.previewImport.mockResolvedValue(preview({ source: imported }));
    const { onImported } = renderDialog();

    await user.click(await screen.findByRole("button", { name: /Fix the parser bug/ }));
    expect(await screen.findByText(labels.ompImportImportedHint)).toBeInTheDocument();
    expect(screen.getByText(labels.ompImportSourceChanged)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: labels.ompImportOpen }));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith("session-existing"));
    expect(mocks.importSession).not.toHaveBeenCalled();
  });

  it("localizes known warning codes and falls back to Core's message for an unknown one", async () => {
    const user = userEvent.setup();
    mocks.previewImport.mockResolvedValue(preview({
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
    mocks.previewImport.mockResolvedValue(preview());
    renderDialog();

    await user.click(screen.getByRole("radio", { name: labels.ompImportAllWorkspaces }));
    await waitFor(() => expect(mocks.importSessions).toHaveBeenLastCalledWith("omp", { all: true, query: "", limit: 100 }));

    await user.type(screen.getByRole("textbox", { name: labels.ompImportSearch }), "parser");
    await waitFor(() => expect(mocks.importSessions).toHaveBeenLastCalledWith("omp", { all: true, query: "parser", limit: 100 }));
  });

  it("shows Core's list failure inline", async () => {
    mocks.importSessions.mockRejectedValue("OMP directory is not readable");
    renderDialog();

    expect(await screen.findByText(labels.ompImportListError)).toBeInTheDocument();
    expect(screen.getByText("OMP directory is not readable")).toBeInTheDocument();
  });

  it("shows the disabled empty state and points at Settings → Plugins when no source runs", async () => {
    const user = userEvent.setup();
    mocks.importSources.mockResolvedValue([]);
    const { onOpenPlugins } = renderDialog();

    expect(await screen.findByText(labels.importSourcesEmpty)).toBeInTheDocument();
    expect(screen.getByText(labels.importSourcesEmptyHint)).toBeInTheDocument();
    expect(mocks.importSessions).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: labels.importOpenPlugins }));
    expect(onOpenPlugins).toHaveBeenCalledTimes(1);
  });

  it("offers a source selector only when more than one source runs", async () => {
    const user = userEvent.setup();
    const other: ImportSource = { id: "other", name: "Other", converter: 1 };
    mocks.importSources.mockResolvedValue([omp, other]);
    mocks.importSessions.mockResolvedValue([{ ...session, source: "other" }]);
    renderDialog();

    const picker = await screen.findByRole("button", { name: labels.importSource });
    await waitFor(() => expect(mocks.importSessions).toHaveBeenCalledWith("omp", { all: false, query: "", limit: 100 }));

    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "Other" }));
    await waitFor(() => expect(mocks.importSessions).toHaveBeenLastCalledWith("other", { all: false, query: "", limit: 100 }));
  });

  it("opens on the source its plugin entry named", async () => {
    const other: ImportSource = { id: "other", name: "Other", converter: 1 };
    mocks.importSources.mockResolvedValue([omp, other]);
    mocks.importSessions.mockResolvedValue([{ ...session, source: "other" }]);
    renderDialog(vi.fn(), vi.fn(), vi.fn(), "other");

    await waitFor(() => expect(mocks.importSessions).toHaveBeenCalledWith("other", { all: false, query: "", limit: 100 }));
    // The named source is confirmed before the list is read: the first source never flashes.
    expect(mocks.importSessions).not.toHaveBeenCalledWith("omp", expect.anything());
  });

  it("keeps the single-source title and shows no selector", async () => {
    mocks.importSessions.mockResolvedValue([]);
    renderDialog();

    expect(await screen.findByRole("dialog", { name: labels.ompImportTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: labels.importSource })).not.toBeInTheDocument();
  });
});
