import type { AppAPI } from "../lib/bridge";
import type {
  CheckArtifact,
  CheckResult,
  ChecksInfo,
  Health,
  LSPStatus,
  Message,
  ConfigState,
  CredentialStatus,
  ProviderCatalog,
  RuntimeEvent,
  Session,
  SessionCheckpoint,
  SessionRuntime,
  SubagentNode,
  TaskStateInfo,
} from "../types";
import { cancelVisualSubtree, startVisualTask } from "./task-fixture";

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
  modelRef: "openai/gpt-5.6",
  metadata: { runtime, ui: { title: "Provider settings refactor" } },
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
    { ref: "openai/gpt-5.6", providerName: "[OI]", modelName: "GPT-5.6", modelID: "gpt-5.6", context: 128000, output: 32000, toolCalling: true, inputModalities: ["text"], reasoningFormat: "", apiKeyEnv: "OPENAI_API_KEY", apiKeySet: true, efforts: ["low", "medium", "high"] },
    { ref: "openai/gpt-5.6-mini", providerName: "[OI]", modelName: "GPT-5.6 Mini", modelID: "gpt-5.6-mini", context: 64000, output: 16000, toolCalling: true, inputModalities: ["text"], reasoningFormat: "", apiKeyEnv: "OPENAI_API_KEY", apiKeySet: true },
    { ref: "openai/embed-text", providerName: "[OI]", modelName: "Embed Text", modelID: "embed-text", context: 8192, output: 512, toolCalling: false, inputModalities: ["text"], reasoningFormat: "", apiKeyEnv: "OPENAI_API_KEY", apiKeySet: true },
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
    anthropic: {
      name: "Anthropic",
      package: "anthropic-messages",
      settings: {
        baseURL: "https://api.anthropic.com",
        apiKey: "{env:ANTHROPIC_API_KEY}",
      },
      models: {
        "claude-4-5": {
          name: "the model",
          modelID: "claude-4-5",
          limit: { context: 200000, output: 16000 },
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
  kind: "subagent",
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

// The harness's credential file: keys live only in this map, and no stub answer ever
// contains a value from it — SaveProviderCredential's response is built from fixed strings.
const visualStoredKeys = new Map<string, string>();

// SaveProviderCredential classifies its value like the backend: an environment placeholder
// (${NAME} or {env:NAME}) becomes an {env:NAME} reference in config (any stored key removed);
// anything else is a literal stored in the credentials file under a {secret:NAME} reference.
// Spring-style ${NAME:default} placeholders are refused.
const ENV_VALUE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$|^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/;

// Which names the stub's fake environment happens to have set (mirrors visualConfigState).
const visualEnvSet: Record<string, boolean> = { OPENAI_API_KEY: true, DEEPSEEK_API_KEY: false, ANTHROPIC_API_KEY: false };

function storedSecretName(scope: string, providerId: string): string {
  return `lumencortex-${scope}-${providerId}`.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 128);
}

function credentialStatusFor(scope: "global" | "workspace", providerId: string): CredentialStatus {
  const ref = providerCatalog.providers[providerId]?.settings?.apiKey || "";
  const secret = ref.startsWith("{secret:") && ref.endsWith("}");
  const envMatch = /^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(ref);
  return {
    providerId,
    scope,
    source: secret ? "stored" : envMatch ? "env" : "none",
    ref: ref || undefined,
    set: secret
      ? visualStoredKeys.has(`${scope}/${providerId}`)
      : envMatch
        ? Boolean(visualEnvSet[envMatch[1]])
        : false,
  };
}

/** Core answers for the configuration, Git, MCP, skills, Task State and checks surfaces. */
export function visualAppStub() {
  return {
    GetConfigState: async () => visualConfigState,
    GetProviderCatalogScope: async (scope) => ({
      scope,
      path: visualConfigState.globalPath,
      digest: visualConfigState.globalDigest,
      catalog: providerCatalog,
    }),
    SaveProviderCatalogScope: async (_scope, doc) => doc,
    GetProviderCredentialStatus: async (scope, providerId) => credentialStatusFor(scope, providerId),
    SaveProviderCredential: async (scope, providerId, value) => {
      const provider = providerCatalog.providers[providerId] ?? (providerCatalog.providers[providerId] = {});
      provider.settings ??= {};
      const match = ENV_VALUE.exec(value.trim());
      if (value.trim().startsWith("$") || value.trim().startsWith("{env:")) {
        if (!match) throw "invalid environment placeholder: ${NAME:default} defaults are not supported";
        // Placeholder: keep the reference in config, drop any stored literal.
        visualStoredKeys.delete(`${scope}/${providerId}`);
        provider.settings!.apiKey = `{env:${match[1] || match[2]}}`;
      } else {
        // Literal: stored in the in-memory credential file only; every response is key-free.
        visualStoredKeys.set(`${scope}/${providerId}`, value);
        const name = storedSecretName(scope, providerId);
        provider.settings!.apiKey = `{secret:${name}}`;
      }
      return credentialStatusFor(scope, providerId);
    },
    RemoveProviderCredential: async (scope, providerId) => {
      visualStoredKeys.delete(`${scope}/${providerId}`);
      const settings = providerCatalog.providers[providerId]?.settings;
      if (settings?.apiKey?.startsWith("{secret:")) settings.apiKey = undefined;
      return credentialStatusFor(scope, providerId);
    },
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
    SessionGitDiff: async (_sessionId, path, staged) => ({
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

    GetMCPConfigsScope: async (scope) =>
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

    GetSkills: async (scope) =>
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
    SaveToolPermissions: async (value) => value,
    TitleBarDoubleClick: async () => undefined,

    GetTaskState: async (sessionId) => ({ ...structuredClone(visualTaskState), sessionId }),
    StartProposedTask: async (_parentId, taskId) => startVisualTask(taskId),
    CancelSubtree: async (sessionId) => cancelVisualSubtree(sessionId),
    SetTaskBrief: async (_id, brief) => editVisualTaskState((state) => { state.brief = brief; }),
    EditTaskReference: async (_id, edit) =>
      editVisualTaskState((state) => {
        const kept = (state.references ?? []).filter((ref) => ref.target !== edit.target);
        if (edit.state !== "removed") {
          kept.push({ id: `ref_${edit.target}`, kind: edit.kind, target: edit.target, note: edit.note, state: edit.state, by: "user", at: new Date().toISOString() });
        }
        state.references = kept;
      }),
    ResolveThread: async (_id, resolution) =>
      editVisualTaskState((state) => { state.resolution = { state: resolution, by: "user", actor: "desktop-user" }; }),
    ResetContext: async () => { throw "run is active in another process or engine"; },
    GetSessionChecks: async () => structuredClone(visualChecks),
    GetCheckResults: async (_id, beforeSeq, limit) =>
      structuredClone(visualCheckResults.filter((row) => beforeSeq <= 0 || row.seq! < beforeSeq).slice(0, limit)),
    GetCheckArtifact: async (_id, hash) => {
      const artifact = visualArtifacts[hash];
      if (!artifact) throw "artifact not found";
      return structuredClone(artifact);
    },
    AcceptCheck: async (_id, checkId) => acceptVisualCheck(checkId),
  } satisfies Partial<AppAPI>;
}
