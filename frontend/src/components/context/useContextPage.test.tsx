import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, TaskNote, TaskStateInfo, ThreadNoteView } from "../../types";
import { copy, type AppCopy } from "../../lib/i18n/app-copy";
import { useContextPage } from "./useContextPage";

const mocks = vi.hoisted(() => ({
  taskState: vi.fn(),
  threadNotes: vi.fn(),
  editTaskNote: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels: AppCopy = copy.en;

const alpha: Session = {
  id: "s-alpha",
  createdAt: "2026-10-20T09:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  status: "completed",
  goal: "Alpha thread",
  metadata: { ui: { title: "Alpha thread" } },
};
const beta: Session = {
  id: "s-beta",
  createdAt: "2026-10-20T11:00:00.000Z",
  updatedAt: "2026-10-20T12:00:00.000Z",
  status: "completed",
  goal: "Beta thread",
  metadata: { ui: { title: "Beta thread" } },
};
const sessions = [alpha, beta];

const alphaOldest: TaskNote = {
  id: "n1",
  by: "user",
  text: "Alpha decision: keep the storage backend.",
  at: "2026-10-20T09:30:00.000Z",
  cites: [{ path: "docs/alpha.md", blob: "a1" }],
};
const alphaNewest: TaskNote = {
  id: "n2",
  by: "agent",
  text: "Alpha fact: retries stay off.",
  at: "2026-10-20T09:40:00.000Z",
  cites: [{ path: "src/retry.ts", blob: "b2" }],
};
const betaNote: TaskNote = {
  id: "n3",
  by: "agent",
  text: "Beta fact: the gate accepts one step.",
  at: "2026-10-20T11:30:00.000Z",
  cites: [{ path: "docs/beta.md", blob: "c3" }],
};

function info(sessionId: string, version: number, notes: TaskNote[]): TaskStateInfo {
  return {
    sessionId,
    version,
    pendingEdits: 0,
    state: { notes, resolution: { state: "open" }, windowStartSeq: 0 },
    obligations: [],
    readyForReview: false,
  };
}

// Core's read_thread view: the stale agent note cites a file that changed, the others are fresh.
const alphaNotes: ThreadNoteView[] = [
  { id: "n1", by: "user", text: alphaOldest.text, cites: [{ path: "docs/alpha.md" }] },
  { id: "n2", by: "agent", text: alphaNewest.text, cites: [{ path: "src/retry.ts", stale: true }], stale: true },
];
const betaNotes: ThreadNoteView[] = [
  { id: "n3", by: "agent", text: betaNote.text, cites: [{ path: "docs/beta.md", stale: false }], stale: false },
];

function Host({ onError = vi.fn(), enabled = true }: { onError?: (message: string) => void; enabled?: boolean }) {
  const page = useContextPage({
    enabled,
    workspace: "/demo/Projects/LumenCortex",
    sessions,
    labels,
    locale: "en",
    onOpenThread: vi.fn(),
    onError,
  });
  return (
    <div>
      <aside>{page.sidebar}</aside>
      <main>{page.content}</main>
    </div>
  );
}

async function openNotes() {
  await userEvent.click(await screen.findByText(labels.contextFilterNotes));
}

describe("useContextPage notes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.taskState.mockImplementation(async (id: string) => (id === alpha.id ? info(alpha.id, 3, [alphaOldest, alphaNewest]) : info(beta.id, 1, [betaNote])));
    mocks.threadNotes.mockImplementation(async (id: string) => (id === alpha.id ? alphaNotes : betaNotes));
  });

  it("lists notes from two threads newest first, searches text and thread title, and opens the source thread", async () => {
    render(<Host />);
    await openNotes();

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain(betaNote.text);
    expect(rows[1].textContent).toContain(alphaNewest.text);
    expect(rows[2].textContent).toContain(alphaOldest.text);
    expect(rows[1].textContent).toContain(labels.taskNoteByAgent);
    expect(rows[1].textContent).toContain("Alpha thread");
    expect(rows[1].textContent).toContain(labels.contextNoteCites(1));

    const search = screen.getByRole("searchbox", { name: labels.contextSearchLabel });
    await userEvent.type(search, "Beta fact");
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.getByRole("listitem").textContent).toContain(betaNote.text);

    await userEvent.clear(search);
    await userEvent.type(search, "Alpha thread");
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));

    await userEvent.clear(search);
    await userEvent.click(await screen.findByText(alphaOldest.text));
    expect(await screen.findByRole("heading", { name: "Alpha thread" })).toBeInTheDocument();
  });

  it("keeps partial Task State read failures local and allows retry", async () => {
    const onError = vi.fn();
    mocks.taskState.mockImplementation(async (id: string) => {
      if (id === alpha.id) throw new Error("temporary read failure");
      return info(beta.id, 1, [betaNote]);
    });
    render(<Host onError={onError} />);

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(labels.contextStatePartialError(1));
    expect(onError).not.toHaveBeenCalled();

    mocks.taskState.mockImplementation(async (id: string) =>
      id === alpha.id ? info(alpha.id, 3, [alphaOldest, alphaNewest]) : info(beta.id, 1, [betaNote]),
    );
    await userEvent.click(within(warning).getByRole("button", { name: labels.retry }));

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(onError).not.toHaveBeenCalled();
  });

  it("shows Core's stale marker and the stale cite, and none for a fresh thread", async () => {
    render(<Host />);
    await openNotes();
    await waitFor(() => expect(mocks.threadNotes).toHaveBeenCalledWith(beta.id));

    await userEvent.click(await screen.findByText(alphaNewest.text));
    const stale = await screen.findByRole("article");
    await waitFor(() => expect(within(stale).getByText(labels.contextNoteStale)).toBeInTheDocument());
    expect(within(stale).getByText(labels.contextNoteCiteStale)).toBeInTheDocument();
    expect(within(stale).getByText("retry.ts")).toBeInTheDocument();

    await userEvent.click(screen.getByText(betaNote.text));
    const fresh = await screen.findByRole("article");
    expect(within(fresh).getByText(betaNote.text)).toBeInTheDocument();
    expect(within(fresh).queryByText(labels.contextNoteStale)).toBeNull();
    expect(within(fresh).queryByText(labels.contextNoteCiteStale)).toBeNull();
  });

  it("forgets a note through Core and drops it from the returned state", async () => {
    mocks.editTaskNote.mockResolvedValue(info(alpha.id, 4, [alphaOldest]));
    render(<Host />);
    await openNotes();
    await userEvent.click(await screen.findByText(alphaNewest.text));
    const article = await screen.findByRole("article");
    await waitFor(() => expect(within(article).getByText(labels.contextNoteStale)).toBeInTheDocument());

    // Newest first: the stale agent note is the first Forget in the section.
    await userEvent.click(within(article).getAllByRole("button", { name: labels.contextNoteForget })[0]);
    expect(mocks.editTaskNote).toHaveBeenCalledWith(alpha.id, { id: alphaNewest.id, remove: true });
    await waitFor(() => expect(screen.queryByText(alphaNewest.text)).toBeNull());
    expect(within(screen.getByRole("article")).getByText(alphaOldest.text)).toBeInTheDocument();
  });

  it("still lists notes when freshness cannot be read", async () => {
    mocks.threadNotes.mockRejectedValue(new Error("workspace unavailable"));
    const onError = vi.fn();
    render(<Host onError={onError} />);
    await openNotes();
    await userEvent.click(await screen.findByText(alphaNewest.text));

    const article = await screen.findByRole("article");
    expect(within(article).getByText(alphaNewest.text)).toBeInTheDocument();
    await waitFor(() => expect(mocks.threadNotes).toHaveBeenCalled());
    expect(within(article).queryByText(labels.contextNoteStale)).toBeNull();
    expect(within(article).queryByText(labels.contextNoteCiteStale)).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("reads freshness again when the page is entered again, since files change without a Task State edit", async () => {
    const { rerender } = render(<Host />);
    await openNotes();
    await waitFor(() => expect(screen.getByText(labels.contextNoteStale)).toBeInTheDocument());

    // The cited file is restored while the page is closed; Task State versions do not move.
    mocks.threadNotes.mockImplementation(async (id: string) =>
      id === alpha.id ? alphaNotes.map((note) => ({ ...note, stale: false, cites: note.cites?.map((cite) => ({ path: cite.path })) })) : betaNotes,
    );
    rerender(<Host enabled={false} />);
    const calls = mocks.threadNotes.mock.calls.length;
    rerender(<Host />);

    await waitFor(() => expect(mocks.threadNotes.mock.calls.length).toBeGreaterThan(calls));
    await waitFor(() => expect(screen.queryByText(labels.contextNoteStale)).toBeNull());
  });
});
