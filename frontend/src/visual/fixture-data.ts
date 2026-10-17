import type { SidebarGroup } from "../components/sidebar/Sidebar";
import { copy, type Locale } from "../lib/i18n/app-copy";
import type {
  CheckArtifact,
  CheckResult,
  ChecksInfo,
  Health,
  LSPStatus,
  Message,
  ConfigState,
  ProviderCatalog,
  RuntimeEvent,
  Session,
  SessionCheckpoint,
  SessionRuntime,
  SubagentNode,
  TaskReferenceEdit,
  TaskStateInfo,
} from "../types";

export type VisualScene = "new-task" | "thread" | "providers" | "review" | "extensions" | "inspector";

const localeParam = typeof window === "undefined"
  ? null
  : new URLSearchParams(window.location.search).get("locale");
export const visualLocale: Locale = localeParam === "zh-CN" ? "zh-CN" : "en";
export const labels = copy[visualLocale];
export const workspace = "/Users/demo/Projects/lumencortex";
export const localRuntime: SessionRuntime = { kind: "local", path: workspace, branch: "main", head: "0f6c33a" };
export const runtime: SessionRuntime = {
  kind: "worktree",
  path: "/Users/demo/Projects/.lumencortex-worktrees/session-demo",
  branch: "lumencortex/demo",
  base: "main",
  head: "98ab42f",
};

export const session: Session = {
  id: "session-demo",
  createdAt: "2026-09-22T01:00:00Z",
  updatedAt: "2026-09-22T02:00:00Z",
  status: "running",
  provider: "openai",
  model: "gpt-5.6",
  goal: "Refactor provider settings and add tests without changing public behavior",
};

export const messages: Message[] = [
  { sessionId: session.id, seq: 0, role: "user", json: { content: "Refactor provider settings and add tests." } },
  { sessionId: session.id, seq: 1, role: "assistant", json: { content: "I’ll inspect the provider configuration and existing tests first." } },
  { sessionId: session.id, seq: 2, role: "tool", json: { name: "search_text", content: JSON.stringify({ path: "internal/backend/provider_config.go", ok: true }) } },
  { sessionId: session.id, seq: 3, role: "assistant", json: { content: "The project already separates global and project scopes. I’ll preserve that contract." } },
];

// Runtime-authored rows (origin) render as notices; the thread scene shows each kind.
export const threadMessages: Message[] = [
  ...messages,
  { sessionId: session.id, seq: 4, role: "tool", json: { tool_call_id: "call_1", origin: "tool_interrupted", content: "run ended before the tool result was saved; re-check workspace state before repeating side effects" } },
  { sessionId: session.id, seq: 5, role: "user", json: { origin: "completion_blocked", content: "Workflow contract rejected completion: the verify action has not passed. Continue the current action and obtain the required evidence." } },
];

export const visualConfigState: ConfigState = {
  workspace: "/repo/lumencortex",
  trusted: true,
  model: "openai/gpt-5.6",
  failover: [],
  models: [
    { ref: "openai/gpt-5.6", providerName: "OpenAI", modelName: "GPT-5.6", modelID: "gpt-5.6", context: 128000, output: 32000, toolCalling: true, inputModalities: ["text"], reasoningFormat: "", apiKeyEnv: "OPENAI_API_KEY", apiKeySet: true },
    { ref: "deepseek/deepseek-chat", providerName: "DeepSeek", modelName: "DeepSeek Chat", modelID: "deepseek-chat", context: 64000, output: 8000, toolCalling: true, inputModalities: ["text"], reasoningFormat: "", apiKeyEnv: "DEEPSEEK_API_KEY", apiKeySet: false },
  ],
  warnings: [
    { code: "untrusted_override", path: "/repo/lumencortex.json", key: "providers.local", trustEntry: "/repo/lumencortex", trustFile: "/home/.config/lumencortex/lumencortex.json", message: "ignored providers.local" },
    { code: "default_limit", key: "deepseek/deepseek-chat.output", message: "model deepseek/deepseek-chat sets no output; using 4096" },
  ],
  globalPath: "/home/.config/lumencortex/lumencortex.json",
  globalDigest: "sha256:visual",
};

export const providerCatalog: ProviderCatalog = {
  model: "openai/gpt-5.6",
  providers: {
    openai: {
      name: "OpenAI",
      package: "openai-compatible",
      settings: {
        baseURL: "https://api.openai.com/v1",
        apiKey: "{env:OPENAI_API_KEY}",
      },
      models: {
        "gpt-5.6": {
          name: "GPT-5.6",
          modelID: "gpt-5.6",
          limit: { context: 128000, output: 32000 },
        },
        "gpt-5.6-mini": {
          name: "GPT-5.6 mini",
          modelID: "gpt-5.6-mini",
          limit: { context: 128000, output: 16000 },
        },
      },
    },
    deepseek: {
      name: "DeepSeek",
      package: "openai-compatible",
      settings: {
        baseURL: "https://api.deepseek.com/v1",
        apiKey: "{env:DEEPSEEK_API_KEY}",
      },
      models: {
        "deepseek-chat": {
          name: "DeepSeek Chat",
          modelID: "deepseek-chat",
          limit: { context: 64000, output: 8000 },
        },
      },
    },
  },
};

const reviewDiff = [
  "diff --git a/frontend/src/components/provider/ProviderSettingsPanel.tsx b/frontend/src/components/provider/ProviderSettingsPanel.tsx",
  "index 201af11..312bc44 100644",
  "--- a/frontend/src/components/provider/ProviderSettingsPanel.tsx",
  "+++ b/frontend/src/components/provider/ProviderSettingsPanel.tsx",
  "@@ -18,7 +18,12 @@ export function ProviderSettingsPanel({",
  "   const t = providerCopy[locale];",
  "-  const controller = useProviderSettingsController(options);",
  "+  const controller = useProviderSettingsController({",
  "+    locale,",
  "+    workspace,",
  "+    selectedModelRef,",
  "+    onSelectedModelRef,",
  "+  });",
  " ",
  "   return (",
  "     <div className=\"provider-settings\">",
].join("\n");

const visualSkills = [
  {
    id: "frontend-desktop",
    name: "Desktop UI",
    description: "Desktop interaction and visual standards",
    scope: "project" as const,
    path: ".lumencortex/skills/frontend-desktop/SKILL.md",
    enabled: true,
    bytes: 612,
  },
  {
    id: "go-runtime",
    name: "Go Runtime",
    description: "Backend runtime implementation rules",
    scope: "global" as const,
    path: "~/.config/lumencortex/skills/go-runtime/SKILL.md",
    enabled: true,
    bytes: 488,
  },
];

const visualSkillContent =
  "---\n" +
  "name: Desktop UI\n" +
  "description: Keep LumenCortex dense, calm, and desktop-native.\n" +
  "---\n\n" +
  "# Instructions\n\n" +
  "- Prefer compact controls and stable panel geometry.\n" +
  "- Keep responsive navigation reachable at narrow widths.\n" +
  "- Add visual regression coverage for interaction states.\n";

const visualMCPConfig = {
  id: "filesystem",
  name: "Filesystem Tools",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", workspace],
  protocolMode: "modern" as const,
  disabled: false,
};

export const visualEvents: RuntimeEvent[] = [
  { seq: 1, at: "2026-09-22T01:02:00Z", type: "run.started", sessionId: session.id, data: {} },
  { seq: 2, at: "2026-09-22T01:03:00Z", type: "worktree.created", sessionId: session.id, data: { branch: runtime.branch } },
  { seq: 3, at: "2026-09-22T01:05:00Z", type: "tool.end", sessionId: session.id, data: { name: "search_text", path: "frontend/src", exitCode: 0 } },
  { seq: 4, at: "2026-09-22T01:08:00Z", type: "workflow.transition", sessionId: session.id, data: { title: "Refactor provider settings" } },
  { seq: 5, at: "2026-09-22T01:11:00Z", type: "subagent.spawned", sessionId: session.id, data: { goal: "Review provider tests" } },
  { seq: 6, at: "2026-09-22T01:16:00Z", type: "tool.end", sessionId: session.id, data: { name: "shell", command: "npm test", exitCode: 0 } },
];

export const health: Health = {
  version: "0.1.0",
  workspace,
  database: "/Users/demo/Library/Application Support/LumenCortex/lumencortex.db",
  budget: { softBytes: 67108864, hardBytes: 134217728, maxAgents: 4 },
  usedBytes: 24117248,
  activeAgents: 1,
  pressure: false,
};

export const lspStatus: LSPStatus = {
  running: true,
  name: "typescript-language-server",
  command: "typescript-language-server",
  pid: 42117,
  pendingRequests: 0,
  diagnostics: 2,
};

export const subagents: SubagentNode[] = [{
  sessionId: "subagent-1",
  parentSessionId: session.id,
  goal: "Review provider tests",
  status: "running",
  active: true,
  createdAt: "2026-09-22T01:11:00Z",
  updatedAt: "2026-09-22T01:16:00Z",
  runtime,
  children: [],
}];

export const checkpoints: SessionCheckpoint[] = [{
  sessionId: session.id,
  seq: 4,
  at: "2026-09-22T01:08:00Z",
  reason: "workflow",
  json: { action: "refactor-provider" },
}];

export const groups: SidebarGroup[] = [
  {
    key: "running",
    label: labels.runningThreads,
    sessions: [{
      session,
      runtime,
      title: "Provider settings refactor",
      active: true,
      pinned: false,
      archived: false,
      statusLabel: labels.running,
    }],
  },
  {
    key: "attention",
    label: labels.attentionThreads,
    sessions: [{
      session: {
        ...session,
        id: "session-attention",
        status: "waiting_gate",
        goal: "Approve database migration before continuing",
      },
      runtime: localRuntime,
      title: "Approve database migration",
      active: false,
      pinned: false,
      archived: false,
      attentionTone: "warning",
      statusLabel: "Waiting for approval",
    }],
  },
  {
    key: "recent",
    label: labels.recentThreads,
    sessions: [{
      session: { ...session, id: "session-recent", status: "completed", goal: "Improve review diff rendering" },
      runtime: localRuntime,
      title: "Improve review diff rendering",
      active: false,
      pinned: false,
      archived: false,
      statusLabel: "Completed",
    }],
  },
];

export const sidebarLabels = {
  close: labels.close,
  collapse: labels.collapseSidebar,
  newTask: labels.newTask,
  project: labels.project,
  openProject: labels.openProject,
  sessions: labels.sessions,
  noSessions: labels.noSessions,
  threadSearch: labels.threadSearch,
  recentProjects: labels.recentProjects,
  providerSettings: labels.providerSettings,
  extensions: labels.extensions,
  language: labels.language,
  theme: labels.theme,
  themeSystem: labels.themeSystem,
  themeLight: labels.themeLight,
  themeDark: labels.themeDark,
  runtimeReady: labels.runtimeReady,
  runtimeOnline: labels.runtimeOnline,
  runtimeOffline: labels.runtimeOffline,
  renameThread: labels.renameThread,
  pinThread: labels.pinThread,
  unpinThread: labels.unpinThread,
  archiveThread: labels.archiveThread,
  restoreThread: labels.restoreThread,
  deleteThread: labels.deleteThread,
  save: labels.save,
  cancel: labels.cancel,
  threadMenu: labels.threadMenu,
  localRuntime: labels.localRuntime,
  worktreeRuntime: labels.worktreeRuntime,
};

// The Task State the inspector's Task tab shows; edits change this copy, as Core's host view would.
let visualTaskState: TaskStateInfo = {
  sessionId: session.id,
  version: 4,
  pendingEdits: 0,
  state: {
    brief: "Refactor provider settings without changing the saved file format.",
    references: [
      { id: "ref_a", kind: "path", target: "internal/backend/provider_config.go", note: "scope merge lives here", state: "included", by: "user", at: "2026-09-22T01:04:00Z" },
      { id: "ref_b", kind: "path", target: "frontend/src/components/provider/ProvidersPane.tsx", state: "suggested", by: "agent", at: "2026-09-22T01:09:00Z" },
      { id: "ref_c", kind: "path", target: "docs/legacy-provider-notes.md", state: "excluded", by: "user", at: "2026-09-22T01:10:00Z" },
    ],
    resolution: { state: "open", by: "reopen", actor: "runtime" },
    windowStartSeq: 0,
  },
  obligations: ["work_units", "pending_application"],
  readyForReview: false,
};

function editVisualTaskState(change: (state: TaskStateInfo["state"]) => void): TaskStateInfo {
  const next: TaskStateInfo = structuredClone(visualTaskState);
  change(next.state);
  next.pendingEdits += 1;
  visualTaskState = next;
  return structuredClone(next);
}

const logHash = `sha256:${"1a".repeat(32)}`;
const diffHash = `sha256:${"2b".repeat(32)}`;
const earlierLogHash = `sha256:${"3c".repeat(32)}`;
const failedTest: CheckResult = { seq: 2, check: "go-test", kind: "test", status: "failed", provenance: "runtime", fingerprint: "sha256:current", artifacts: [logHash, diffHash], at: "2026-09-22T01:12:00Z" };
const acceptedBuild: CheckResult = { seq: 3, check: "frontend-build", kind: "build", status: "passed", provenance: "human:desktop-user", fingerprint: "sha256:current", artifacts: [], at: "2026-09-22T01:14:00Z" };

// The Checks tab's view: one failing required test with its log and diff, one build the user accepted,
// one optional check never run, and a project check dropped because the project is not trusted.
let visualChecks: ChecksInfo = {
  sessionId: session.id,
  env: { head: "5f3c2a9e1b7d4c60a8e2f91b3d5c7a9e0f1b2c3d", dirtyHash: "sha256:dirty", worktreeId: "" },
  checks: [
    { spec: { id: "go-test", kind: "test", command: "go test -count=1 ./internal/backend/...", timeout: 600e9, required: true, source: "global" }, satisfied: false, newest: failedTest },
    { spec: { id: "frontend-build", kind: "build", command: "npm --prefix frontend run build", timeout: 300e9, required: true, source: "global" }, satisfied: true, deciding: acceptedBuild, newest: acceptedBuild },
    { spec: { id: "lint", kind: "test", command: "npx eslint frontend/src", timeout: 120e9, required: false, source: "global" }, satisfied: false },
  ],
  warnings: [
    { code: "untrusted_override", path: "/repo/lumencortex.json", key: "checks.e2e", trustEntry: "/repo/lumencortex", trustFile: "/home/.config/lumencortex/lumencortex.json", message: "ignored checks.e2e" },
  ],
};
let visualCheckResults: CheckResult[] = [
  acceptedBuild,
  failedTest,
  { seq: 1, check: "go-test", kind: "test", status: "passed", provenance: "runtime", fingerprint: "sha256:earlier", artifacts: [earlierLogHash], at: "2026-09-22T00:58:00Z" },
];
const visualArtifacts: Record<string, CheckArtifact> = {
  [logHash]: {
    hash: logHash,
    kind: "log",
    size: 412,
    truncated: false,
    text: "--- FAIL: TestProviderScopeMerge (0.02s)\n    provider_config_test.go:88: headers = map[], want map[X-Org:acme]\nFAIL\nFAIL\tgithub.com/edynasty/LumenCortex-Desktop/internal/backend\t1.204s\n",
  },
  [diffHash]: {
    hash: diffHash,
    kind: "diff",
    size: 318,
    truncated: false,
    text: "diff --git a/internal/backend/provider_config.go b/internal/backend/provider_config.go\n@@ -112,7 +112,6 @@ func mergeScope(global, workspace Catalog) Catalog {\n-\tout.Headers = maps.Clone(workspace.Headers)\n+\tout.Headers = workspace.Headers\n",
  },
  [earlierLogHash]: { hash: earlierLogHash, kind: "log", size: 64, truncated: false, text: "ok  \tgithub.com/edynasty/LumenCortex-Desktop/internal/backend\t1.118s\n" },
};

function acceptVisualCheck(checkId: string): CheckResult {
  const check = visualChecks.checks?.find((item) => item.spec.id === checkId);
  if (!check) throw "check is not configured";
  const result: CheckResult = { seq: visualCheckResults[0].seq! + 1, check: checkId, kind: check.spec.kind, status: "passed", provenance: "human:desktop-user", fingerprint: "sha256:current", artifacts: [], at: new Date().toISOString() };
  visualCheckResults = [result, ...visualCheckResults];
  visualChecks = {
    ...visualChecks,
    checks: (visualChecks.checks ?? []).map((item) => (item.spec.id === checkId ? { ...item, satisfied: true, deciding: result, newest: result } : item)),
  };
  return result;
}

export function installVisualAppStub() {
  const visualApp = {
    GetConfigState: async () => visualConfigState,
    GetProviderCatalogScope: async (scope: string) => ({
      scope,
      path: visualConfigState.globalPath,
      digest: visualConfigState.globalDigest,
      catalog: providerCatalog,
    }),
    SaveProviderCatalogScope: async (_scope: string, doc: unknown) => doc,
    TestProviderConnection: async () => ({ ok: true, models: 2, message: "Connected" }),
    DiscoverProviderModels: async () => [{ id: "gpt-5.6" }, { id: "gpt-5.6-mini" }],

    SessionGitStatus: async () => ({
      files: [
        { path: "frontend/src/components/provider/ProviderSettingsPanel.tsx", index: " ", worktree: "M" },
        { path: "frontend/src/components/provider/provider-settings.css", index: " ", worktree: "M" },
        { path: "frontend/src/components/provider/ProviderSettingsPanel.test.tsx", index: "A", worktree: " " },
      ],
    }),
    WorktreeConflicts: async () => [],
    SessionGitDiff: async (_sessionId: string, path: string, staged: boolean) => ({
      path,
      content: reviewDiff,
      bytes: reviewDiff.length,
      truncated: false,
      staged,
    }),
    SessionGitStage: async () => ({ output: "Staged", truncated: false }),
    SessionGitUnstage: async () => ({ output: "Unstaged", truncated: false }),
    SessionGitRevert: async () => ({ output: "Reverted", truncated: false }),
    SessionGitCommit: async () => ({ output: "[main 98ab42f] UI refinement", truncated: false }),
    SessionGitPush: async () => ({ output: "Everything up-to-date", truncated: false }),

    GetMCPConfigsScope: async (scope: string) =>
      scope === "project" ? [] : [visualMCPConfig],
    GetMCPStatuses: async () => [{
      id: visualMCPConfig.id,
      name: visualMCPConfig.name,
      command: visualMCPConfig.command,
      workspace,
      protocolMode: "modern",
      protocolVersion: "2026-07-28",
      running: true,
      pid: 53121,
      pendingRequests: 0,
      tools: 2,
    }],
    GetMCPTools: async () => [
      {
        name: "mcp__filesystem__read_file",
        description: "Read a text file in the project",
        inputSchema: { type: "object" },
        serverId: visualMCPConfig.id,
        toolName: "read_file",
        readOnly: true,
      },
      {
        name: "mcp__filesystem__write_file",
        description: "Write a text file in the project",
        inputSchema: { type: "object" },
        serverId: visualMCPConfig.id,
        toolName: "write_file",
        readOnly: false,
      },
    ],
    SaveMCPConfigScope: async () => undefined,
    DeleteMCPConfigScope: async () => undefined,
    StartMCP: async () => ({
      id: visualMCPConfig.id,
      protocolMode: "modern",
      running: true,
      pendingRequests: 0,
      tools: 2,
    }),
    StopMCP: async () => undefined,
    RefreshMCPTools: async () => undefined,

    GetSkills: async (scope: string) =>
      scope === "global"
        ? visualSkills.filter((skill) => skill.scope === "global")
        : scope === "project"
          ? visualSkills.filter((skill) => skill.scope === "project")
          : visualSkills,
    GetSkillContent: async () => visualSkillContent,
    SaveSkill: async () => undefined,
    DeleteSkill: async () => undefined,
    SetSkillEnabled: async () => undefined,
    GetToolPermissions: async () => ({ disabled: ["shell"] }),
    SaveToolPermissions: async (value: { disabled: string[] }) => value,

    GetTaskState: async () => structuredClone(visualTaskState),
    SetTaskBrief: async (_id: string, brief: string) => editVisualTaskState((state) => { state.brief = brief; }),
    EditTaskReference: async (_id: string, edit: TaskReferenceEdit) =>
      editVisualTaskState((state) => {
        const kept = (state.references ?? []).filter((ref) => ref.target !== edit.target);
        if (edit.state !== "removed") {
          kept.push({ id: `ref_${edit.target}`, kind: edit.kind, target: edit.target, note: edit.note, state: edit.state, by: "user", at: new Date().toISOString() });
        }
        state.references = kept;
      }),
    ResolveThread: async (_id: string, resolution: string) =>
      editVisualTaskState((state) => { state.resolution = { state: resolution, by: "user", actor: "desktop-user" }; }),
    ResetContext: async () => { throw "run is active in another process or engine"; },
    GetSessionChecks: async () => structuredClone(visualChecks),
    GetCheckResults: async (_id: string, beforeSeq: number, limit: number) =>
      structuredClone(visualCheckResults.filter((row) => beforeSeq <= 0 || row.seq! < beforeSeq).slice(0, limit)),
    GetCheckArtifact: async (_id: string, hash: string) => {
      const artifact = visualArtifacts[hash];
      if (!artifact) throw "artifact not found";
      return structuredClone(artifact);
    },
    AcceptCheck: async (_id: string, checkId: string) => acceptVisualCheck(checkId),
  };

  Object.defineProperty(window, "go", {
    configurable: true,
    value: { main: { App: visualApp } },
  });
}
