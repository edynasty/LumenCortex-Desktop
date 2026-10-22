import type { AppAPI } from "../lib/bridge";
import type { GitStatus, Message, Session, SessionRuntime, TaskStateInfo, WorkflowSummary, WorkspaceState, WorktreeHandoffPlan } from "../types";
import {
  checkpoints,
  health,
  localRuntime,
  lspStatus,
  runtime,
  session,
  subagents,
  threadMessages,
  visualAppStub,
  visualOMPPreview,
  visualOMPSessions,
  workspace,
} from "./fixture-data";
import { taskSession, taskThreadMessages, visualTaskList, visualTaskTree } from "./task-fixture";

// The visual QA harness's Core: the real App renders over these answers (visual.html only; the
// production build has a single index.html entry). Every value has Core's wire shape; the few
// mutations (new thread, follow-up, pin/archive, delete) change this in-memory copy like Core would.

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 22, 1, minutes)).toISOString();
const ok = (output: string) => ({ output, truncated: false });

// Core rule model.user: an AgentOptions.ModelRef that differs from the session's pinned model
// re-pins it; empty keeps the pin.
function pinModel(session: Session, cfg: { modelRef?: string } | undefined, status: string): Session {
  const modelRef = cfg?.modelRef ?? session.modelRef;
  return { ...session, modelRef, status };
}

const failed: Session = {
  id: "session-failed",
  createdAt: at(30),
  updatedAt: at(42),
  status: "failed",
  modelRef: "deepseek/deepseek-chat",
  goal: "Upgrade the SQLite driver and rerun the migration tests",
  error: { message: "provider deepseek: 429 Too Many Requests (rate limit reached for deepseek-chat)" },
  metadata: { ui: { title: "Upgrade SQLite driver" } },
};

const gate: Session = {
  id: "session-gate",
  createdAt: at(20),
  updatedAt: at(28),
  status: "waiting_gate",
  modelRef: "openai/gpt-5.6",
  goal: "Add a schema migration for session tags",
  metadata: { ui: { title: "Session tags migration" } },
};

const recent: Session = {
  id: "session-recent",
  createdAt: at(0),
  updatedAt: at(9),
  status: "completed",
  modelRef: "openai/gpt-5.6",
  goal: "Improve review diff rendering",
  final: "Diff rows now keep their gutter width while scrolling horizontally.",
  metadata: { ui: { title: "Improve review diff rendering", pinned: true } },
};

const tasks: Session = { ...taskSession, metadata: { ui: { delegation: "propose", title: "Provider settings in tasks" } } };

// A thread imported from OMP before (ADR-0011): its transcript ends with the notice rows the
// import writes, so the harness shows what an imported history looks like in the native view.
const importedOMP: Session = {
  id: "session-omp-imported",
  createdAt: at(44),
  updatedAt: at(45),
  status: "completed",
  goal: "Migration notes",
  metadata: { ui: { title: "Migration notes" }, import: { source: "omp", sessionId: "01a2b3c4-0000-7000-8000-000000000003" } },
};

let sessions: Session[] = [session, tasks, gate, failed, recent, importedOMP];

// The fixture cite the harness reports as changed since its note was written.
const staleFixtureCites: Record<string, true> = { "internal/backend/provider_config.go": true };

// Per-thread Task State for the Context page: each scene thread carries the references the
// graph draws (thread→file, thread→thread, excluded rows that never draw). Wire shapes only.
const contextTaskStates: Record<string, () => Promise<TaskStateInfo> | TaskStateInfo> = {
  [session.id]: () => visualAppStub().GetTaskState(session.id),
  [tasks.id]: () => ({
    sessionId: tasks.id,
    version: 2,
    pendingEdits: 0,
    state: {
      references: [
        { id: "ctx_task_1", kind: "thread", target: session.id, state: "included", by: "user", at: at(12), note: "same refactor" },
        { id: "ctx_task_2", kind: "path", target: "internal/backend/provider_config.go", state: "included", by: "agent", at: at(13) },
        { id: "ctx_task_3", kind: "path", target: "frontend/src/components/provider/ProvidersPane.tsx", state: "suggested", by: "agent", at: at(14) },
      ],
      resolution: { state: "open" },
      windowStartSeq: 0,
      notes: [
        { id: "u3f0a", text: "The schema test is the only evidence the gate accepts; do not widen it.", by: "user", at: at(16) },
      ],
    },
    obligations: ["tasks"],
    readyForReview: false,
  }),
  [gate.id]: () => ({
    sessionId: gate.id,
    version: 1,
    pendingEdits: 0,
    state: {
      references: [
        { id: "ctx_gate_1", kind: "path", target: "internal/store/migrations.go", state: "included", by: "user", at: at(21) },
        { id: "ctx_gate_2", kind: "path", target: "docs/schema-notes.md", state: "suggested", by: "agent", at: at(24) },
      ],
      resolution: { state: "open" },
      windowStartSeq: 0,
    },
    obligations: ["gate"],
    readyForReview: false,
  }),
  [failed.id]: () => ({
    sessionId: failed.id,
    version: 3,
    pendingEdits: 0,
    state: {
      references: [
        { id: "ctx_failed_1", kind: "path", target: "internal/store/migrations.go", state: "included", by: "user", at: at(31) },
        { id: "ctx_failed_2", kind: "path", target: "internal/store/sqlite.go", state: "included", by: "agent", at: at(36) },
        { id: "ctx_failed_3", kind: "path", target: "docs/legacy-provider-notes.md", state: "excluded", by: "user", at: at(38) },
      ],
      resolution: { state: "dropped", by: "user", at: at(40) },
      windowStartSeq: 0,
    },
    obligations: null,
    readyForReview: false,
  }),
  [recent.id]: () => ({
    sessionId: recent.id,
    version: 1,
    pendingEdits: 0,
    state: {
      references: [
        { id: "ctx_recent_1", kind: "path", target: "frontend/src/components/inspector/DiffView.tsx", state: "included", by: "user", at: at(2) },
      ],
      resolution: { state: "done", by: "user", at: at(8) },
      windowStartSeq: 0,
    },
    obligations: null,
    readyForReview: false,
  }),
};

const transcripts: Record<string, Message[]> = {
  [session.id]: threadMessages,
  [importedOMP.id]: [
    { sessionId: importedOMP.id, seq: 0, role: "user", json: { content: "Write down the migration notes." } },
    { sessionId: importedOMP.id, seq: 1, role: "assistant", json: { content: "Notes are in docs/migrations.md." } },
    { sessionId: importedOMP.id, seq: 2, role: "user", json: { content: "[OMP async-result]\nBackground task finished.", origin: "imported_notice" } },
    { sessionId: importedOMP.id, seq: 3, role: "user", json: { content: "[runtime] The messages above were imported from a session of another agent runtime.", origin: "imported" } },
  ],
  [tasks.id]: taskThreadMessages,
  [gate.id]: [
    { sessionId: gate.id, seq: 0, role: "user", json: { content: "Add a schema migration for session tags." } },
    { sessionId: gate.id, seq: 1, role: "assistant", json: { content: "The migration is drafted. Applying it changes the workspace database, so the workflow asks for your approval first." } },
  ],
  [failed.id]: [
    { sessionId: failed.id, seq: 0, role: "user", json: { content: "Upgrade the SQLite driver and rerun the migration tests." } },
    { sessionId: failed.id, seq: 1, role: "assistant", json: { content: "I’ll bump modernc.org/sqlite and run the migration suite." } },
    { sessionId: failed.id, seq: 2, role: "tool", json: { name: "shell", content: JSON.stringify({ command: "go get modernc.org/sqlite@latest", exitCode: 0 }) } },
  ],
  [recent.id]: [
    { sessionId: recent.id, seq: 0, role: "user", json: { content: "Improve review diff rendering." } },
    { sessionId: recent.id, seq: 1, role: "assistant", json: { content: recent.final } },
  ],
};

const gateSummary: WorkflowSummary = {
  id: "wf-migration",
  title: "Schema migration",
  currentAction: "apply",
  currentTitle: "Apply migration",
  terminal: false,
  status: "waiting_gate",
  canFinish: false,
  pendingGates: [{ id: "gate-apply", type: "human", title: "Apply migration 0007_session_tags", description: "Writes the new session_tags table to the workspace database." }],
  facts: {},
};

const mainStatus: GitStatus = {
  files: [
    { path: "docs/architecture.md", index: "M", worktree: " " },
    { path: "frontend/src/styles/tokens.css", index: " ", worktree: "M" },
    { path: "notes/release-checklist.md", index: "?", worktree: "?" },
  ],
};

function runtimeOf(sessionId: string): SessionRuntime {
  if (sessionId === session.id) return runtime;
  const child = visualTaskTree().find((node) => node.sessionId === sessionId);
  return child?.runtime ?? localRuntime;
}

function handoff(sessionId: string): WorktreeHandoffPlan {
  return {
    sessionId,
    runtime: runtimeOf(sessionId),
    targetBranch: "main",
    targetHead: "0f6c33a",
    sourceHead: "98ab42f",
    commits: ["98ab42f Split provider settings controller", "71c0e3d Add scope merge tests"],
    sourceFiles: ["frontend/src/components/provider/ProviderSettingsPanel.tsx", "internal/backend/provider_config_test.go"],
    targetFiles: ["frontend/src/styles/tokens.css"],
    overlappingFiles: [],
    sourceDirty: false,
    targetDirty: true,
    canApply: true,
  };
}

function state(open: boolean): WorkspaceState {
  if (!open) return { workspace: "", sessions: [], activeRuns: [] };
  return { workspace, health, sessions, activeRuns: [{ sessionId: session.id, startedAt: at(2) }] };
}

function find(sessionId: string): Session {
  const found = sessions.find((item) => item.id === sessionId);
  if (!found) throw "session not found";
  return found;
}

function replace(next: Session): Session {
  sessions = sessions.map((item) => (item.id === next.id ? next : item));
  return next;
}

export function visualApp(projectOpen: boolean): AppAPI {
  let open = projectOpen;
  return {
    ...visualAppStub(),
    PickWorkspace: async () => { open = true; return state(open); },
    OpenWorkspace: async () => { open = true; return state(open); },
    GetState: async () => state(open),
    ListSessions: async (limit, offset) => sessions.slice(offset, offset + limit),
    GetSession: async (id) => find(id),
    UpdateSessionUI: async (id, patch) => {
      const current = find(id);
      const ui = { ...((current.metadata as { ui?: object } | undefined)?.ui ?? {}), ...patch };
      return replace({ ...current, metadata: { ...(current.metadata as object), ui } });
    },
    CreateSession: async (goal) => createSession(goal, "local"),
    CreateSessionWithContext: async (goal) => createSession(goal, "local"),
    CreateSessionWithRuntime: async (goal, _paths, kind) => createSession(goal, kind),
    GetSessionRuntime: async (id) => runtimeOf(id),
    InspectSessionWorktree: async (id) => ({
      sessionId: id,
      role: "owner",
      owner: id,
      path: runtimeOf(id).path,
      branch: runtimeOf(id).branch,
      exists: true,
      registered: true,
      branchExists: true,
      head: "98ab42f",
      targetHead: "0f6c33a",
      dirtyFiles: [],
      statusDigest: "sha256:clean",
      unappliedCommits: handoff(id).commits,
    }),
    RemoveSessionWorktree: async () => ({ result: { action: "removed", directoryRemoved: true, branchDeleted: true } }),
    DeleteSession: async (id) => {
      sessions = sessions.filter((item) => item.id !== id);
      return { result: { sessionId: id, worktree: { action: "none" } } };
    },
    WorktreeHandoffPlan: async (id) => handoff(id),
    ApplySessionWorktree: async (id) => ({ plan: handoff(id), action: ok("Fast-forwarded main to 98ab42f"), targetHead: "98ab42f" }),
    PickContextFiles: async () => ["docs/architecture.md"],
    PickContextDirectory: async () => ["internal/backend"],
    MessagePage: async (id, beforeSeq, limit) => {
      const rows = (transcripts[id] ?? []).filter((row) => beforeSeq <= 0 || row.seq < beforeSeq);
      const page = rows.slice(-limit);
      return { messages: page, hasMore: rows.length > page.length, nextBefore: page[0]?.seq ?? 0 };
    },
    RecentMessages: async (id, limit) => (transcripts[id] ?? []).slice(-limit),
    TrustWorkspace: async () => visualAppStub().GetConfigState(),
    SaveConcurrency: async () => visualAppStub().GetConfigState(),
    StartAgent: async (id, cfg) => replace(pinModel({ ...find(id) }, cfg, "running")),
    ContinueAgent: async (id, content, cfg) => {
      const rows = transcripts[id] ?? [];
      transcripts[id] = [...rows, { sessionId: id, seq: (rows.at(-1)?.seq ?? -1) + 1, role: "user", json: { content } }];
      return replace(pinModel({ ...find(id) }, cfg, "running"));
    },
    GetWorkflowSummary: async (id) => (id === gate.id ? gateSummary : null),
    ApproveWorkflowGate: async () => ({ ...gateSummary, status: "running", pendingGates: [] }),
    GetTaskState: async (id) => {
      const info = await (contextTaskStates[id]?.() ?? visualAppStub().GetTaskState(id));
      if (id !== tasks.id) return info;
      return { ...info, state: { ...info.state, tasks: visualTaskList() }, obligations: [...(info.obligations ?? []), "tasks"] };
    },
    // The harness's freshness: this fixture cite changed after its note was written, so the Context
    // page shows the stale marker (Core compares the main checkout's blobs).
    ThreadNotes: async (id) => {
      const info = await (contextTaskStates[id]?.() ?? visualAppStub().GetTaskState(id));
      return (info.state.notes ?? []).map((note) => {
        const cites = (note.cites ?? []).map((cite) => ({ path: cite.path, stale: staleFixtureCites[cite.path] === true }));
        return { id: note.id, by: note.by, text: note.text, cites, stale: cites.some((cite) => cite.stale) };
      });
    },
    SearchText: async () => ({ matches: [], truncated: false, engine: "visual" }),
    FindFiles: async () => ({ paths: [], truncated: false }),
    GitStatus: async () => mainStatus,
    GitDiff: async (path, staged) => {
      const content = `diff --git a/${path} b/${path}\n@@ -1,3 +1,3 @@\n-old line\n+new line\n context\n`;
      return { path, content, bytes: content.length, truncated: false, staged };
    },
    GitStage: async () => ok("Staged"),
    GitUnstage: async () => ok("Unstaged"),
    GitRevert: async () => ok("Reverted"),
    GitCommit: async () => ok("[main 1a2b3c4] Update docs"),
    GitPush: async () => ok("Everything up-to-date"),
    RunShell: async (_id, command) => ({ command, exitCode: 0, duration: 1.2e9, stdout: { total: 0, truncated: false }, stderr: { total: 0, truncated: false }, cancelled: false }),
    StartLSP: async () => lspStatus,
    StopLSP: async () => undefined,
    GetLSPStatus: async () => lspStatus,
    GetLSPDiagnostics: async () => [],
    GetMCPConfigs: async () => visualAppStub().GetMCPConfigsScope("effective"),
    SaveMCPConfig: async () => undefined,
    DeleteMCPConfig: async () => undefined,
    GetSubagentTree: async (id) => (id === tasks.id ? visualTaskTree() : id === session.id ? subagents : []),
    GetSessionCheckpoints: async (id) => (id === session.id ? checkpoints : []),
    // OMP import (ADR-0011): the fixture list, its previews, and an import that adds a session the
    // thread view then opens. The imported row keeps its final `imported` notice.
    ListOMPSessions: async (opts) => {
      const query = (opts.query ?? "").trim().toLowerCase();
      return visualOMPSessions
        .filter((row) => (opts.all || row.workspaceMatch) && (!query || `${row.title ?? ""}\n${row.id}\n${row.cwd}`.toLowerCase().includes(query)))
        .slice(0, opts.limit ?? 100);
    },
    PreviewOMPSession: async (path) => {
      const found = visualOMPSessions.find((row) => row.path === path);
      if (!found) throw "session not found";
      return visualOMPPreview(found);
    },
    ImportOMPSession: async (path) => {
      const found = visualOMPSessions.find((row) => row.path === path);
      if (!found) throw "session not found";
      const preview = visualOMPPreview(found);
      if (found.imported) {
        return { sessionId: found.imported.sessionId, alreadyImported: true, sourceChanged: found.imported.sourceChanged, sessions: 0, preview };
      }
      const now = new Date().toISOString();
      found.imported = { sessionId: preview.sessionId, importedAt: now, sourceChanged: false };
      const imported: Session = {
        id: preview.sessionId,
        createdAt: now,
        updatedAt: now,
        status: "completed",
        goal: preview.goal,
        metadata: { ui: { title: preview.goal }, import: { source: "omp", sessionId: found.id } },
      };
      sessions = [imported, ...sessions];
      transcripts[preview.sessionId] = [
        { sessionId: preview.sessionId, seq: 0, role: "user", json: { content: preview.firstUser } },
        { sessionId: preview.sessionId, seq: 1, role: "assistant", json: { content: preview.lastAssistant } },
        { sessionId: preview.sessionId, seq: 2, role: "user", json: { content: "[runtime] The messages above were imported from a session of another agent runtime.", origin: "imported" } },
      ];
      return { sessionId: preview.sessionId, alreadyImported: false, sourceChanged: false, sessions: 4, preview };
    },
  };
}

function createSession(goal: string, kind: string): Session {
  const id = `session-new-${sessions.length}`;
  const created: Session = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "created",
    modelRef: "openai/gpt-5.6",
    goal,
    metadata: kind === "worktree"
      ? { runtime: { kind: "worktree", path: `/Users/demo/Projects/.lumencortex-worktrees/${id}`, branch: `lumencortex/${id}`, base: "main", head: "0f6c33a" } }
      : {},
  };
  sessions = [created, ...sessions];
  transcripts[id] = [{ sessionId: id, seq: 0, role: "user", json: { content: goal } }];
  return created;
}
