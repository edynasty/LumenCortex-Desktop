import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../types";
import { copy, type AppCopy } from "../../lib/i18n/app-copy";
import { useSourceControlPage } from "./useSourceControlPage";

const mocks = vi.hoisted(() => ({
  gitStatus: vi.fn(),
  gitDiff: vi.fn(),
  inspectSessionWorktree: vi.fn(),
  sessionGitStatus: vi.fn(),
  sessionGitDiff: vi.fn(),
  worktreeConflicts: vi.fn(),
  worktreeHandoffPlan: vi.fn(),
  applySessionWorktree: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels: AppCopy = copy["zh-CN"];

const worktreeSession: Session = {
  id: "s-wt",
  createdAt: "2026-09-22T01:00:00.000Z",
  updatedAt: "2026-09-22T01:20:00.000Z",
  status: "completed",
  goal: "Provider settings refactor",
  metadata: {
    runtime: { kind: "worktree", path: "/demo/.lumencortex-worktrees/s-wt", branch: "lumencortex/s-wt", base: "main", head: "98ab42f" },
  },
};

const localSession: Session = {
  id: "s-local",
  createdAt: "2026-09-22T01:30:00.000Z",
  updatedAt: "2026-09-22T01:40:00.000Z",
  status: "completed",
  goal: "Local chat",
  metadata: {},
};

const sessions = [worktreeSession, localSession];

const mainFiles = [
  { path: "docs/architecture.md", index: "M", worktree: " " },
  { path: "frontend/src/styles/tokens.css", index: " ", worktree: "M" },
];

const inspection = {
  sessionId: "s-wt",
  role: "owner" as const,
  owner: "s-wt",
  path: "/demo/.lumencortex-worktrees/s-wt",
  branch: "lumencortex/s-wt",
  exists: true,
  registered: true,
  branchExists: true,
  head: "98ab42f",
  targetHead: "0f6c33a",
  dirtyFiles: [],
  unappliedCommits: ["98ab42f Split provider settings controller", "71c0e3d Add scope merge tests"],
};

const plan = {
  sessionId: "s-wt",
  runtime: { kind: "worktree" as const, path: "/demo/.lumencortex-worktrees/s-wt", branch: "lumencortex/s-wt" },
  targetBranch: "main",
  targetHead: "0f6c33a",
  sourceHead: "98ab42f",
  commits: ["98ab42f Split provider settings controller", "71c0e3d Add scope merge tests"],
  sourceFiles: [],
  targetFiles: [],
  overlappingFiles: [],
  sourceDirty: false,
  targetDirty: false,
  canApply: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gitStatus.mockResolvedValue({ files: mainFiles });
  mocks.gitDiff.mockResolvedValue({ path: "docs/architecture.md", content: "@@ -1 +1 @@\n-old\n+new", bytes: 30, truncated: false, staged: false });
  mocks.inspectSessionWorktree.mockResolvedValue(inspection);
  mocks.sessionGitStatus.mockResolvedValue({ files: mainFiles });
  mocks.sessionGitDiff.mockResolvedValue({ path: "docs/architecture.md", content: "@@ -1 +1 @@\n-old\n+new", bytes: 30, truncated: false, staged: false });
  mocks.worktreeConflicts.mockResolvedValue([]);
  mocks.worktreeHandoffPlan.mockResolvedValue(plan);
  mocks.applySessionWorktree.mockResolvedValue({ plan, action: { output: "Fast-forwarded main to 98ab42f", truncated: false }, targetHead: "98ab42f" });
});

type HostProps = {
  enabled?: boolean;
  checkout?: "main" | string;
  onSelectCheckout?: (checkout: "main" | string) => void;
};

function Host({ enabled = true, checkout = "main", onSelectCheckout = vi.fn() }: HostProps) {
  const page = useSourceControlPage({
    enabled,
    workspace: "/demo/Projects/LumenCortex",
    sessions,
    checkout,
    labels,
    locale: "zh-CN",
    onSelectCheckout,
    onOpenThread: vi.fn(),
    onCleanupWorktree: vi.fn(),
    onError: vi.fn(),
  });
  return (
    <div>
      <aside>{page.sidebar}</aside>
      <main>{page.content}</main>
    </div>
  );
}

describe("useSourceControlPage", () => {
  it("lists Core's files for the main checkout", async () => {
    render(<Host checkout="main" />);

    // PathLabel renders the directory dimmed and the name bright: the file row and the diff head.
    const names = await screen.findAllByText("architecture.md");
    expect(names.length).toBe(2);
    expect(screen.getByText("tokens.css")).toBeInTheDocument();
    // Once for the sidebar's change count, once for the changes view's file list.
    expect(mocks.gitStatus).toHaveBeenCalledTimes(2);
    expect(mocks.gitDiff).toHaveBeenCalledWith("docs/architecture.md", false);
  });
  it("selects a worktree row through onSelectCheckout", async () => {
    const onSelectCheckout = vi.fn();
    render(<Host checkout="main" onSelectCheckout={onSelectCheckout} />);

    await userEvent.click(await screen.findByTitle(/lumencortex\/s-wt/));
    expect(onSelectCheckout).toHaveBeenCalledWith("s-wt");
  });

  it("replaces the loading state with unknown when Core cannot read the checkout status", async () => {
    mocks.gitStatus.mockRejectedValue(new Error("not a git repository"));
    render(<Host checkout="main" />);

    await waitFor(() => expect(screen.getAllByText(labels.unknown).length).toBeGreaterThan(0));
    expect(screen.queryByText(labels.loading)).not.toBeInTheDocument();
  });

  it("makes no bridge call while disabled", async () => {
    render(<Host enabled={false} />);

    await waitFor(() => {
      expect(screen.getByTitle(/lumencortex\/s-wt/)).toBeInTheDocument();
    });
    expect(mocks.gitStatus).not.toHaveBeenCalled();
    expect(mocks.inspectSessionWorktree).not.toHaveBeenCalled();
    expect(mocks.sessionGitStatus).not.toHaveBeenCalled();
    expect(mocks.worktreeHandoffPlan).not.toHaveBeenCalled();
  });

  it("shows Core's inspection and applies through applySessionWorktree", async () => {
    render(<Host checkout="s-wt" />);

    // The worktree header shows Core's branch; the commits tab lists its unapplied commits.
    expect((await screen.findAllByText("lumencortex/s-wt")).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("radio", { name: new RegExp(labels.scmTabCommits) }));
    expect(await screen.findByText("Split provider settings controller")).toBeInTheDocument();
    expect(mocks.inspectSessionWorktree).toHaveBeenCalledWith("s-wt");

    // The handoff strip's Apply confirms first, then calls Core.
    expect(await screen.findByText(labels.handoffTitle)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: labels.handoffApply })[0]);
    await userEvent.click(screen.getAllByRole("button", { name: labels.handoffApply })[1]);
    await waitFor(() => {
      expect(mocks.applySessionWorktree).toHaveBeenCalledTimes(1);
    });
  });
});
