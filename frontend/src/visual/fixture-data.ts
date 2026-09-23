import type { SidebarGroup } from "../components/sidebar/Sidebar";
import { copy } from "../lib/i18n/app-copy";
import type {
  Health,
  LSPStatus,
  Message,
  ProviderCatalog,
  RuntimeEvent,
  Session,
  SessionCheckpoint,
  SessionRuntime,
  SubagentNode,
} from "../types";

export type VisualScene = "new-task" | "thread" | "providers" | "review" | "extensions" | "inspector";

export const labels = copy.en;
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

export const reviewMessages: Message[] = [
  ...messages,
  {
    sessionId: session.id,
    seq: 4,
    role: "tool",
    json: {
      name: "shell",
      content: JSON.stringify({
        command: "npm test",
        exitCode: 0,
        cancelled: false,
        stdout: { total: 4821, truncated: false },
        stderr: { total: 0, truncated: false },
      }),
    },
  },
  {
    sessionId: session.id,
    seq: 5,
    role: "tool",
    json: {
      name: "shell",
      content: JSON.stringify({
        command: "npm run build",
        exitCode: 0,
        cancelled: false,
        stdout: { total: 2140, truncated: false },
        stderr: { total: 0, truncated: false },
      }),
    },
  },
];

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
    label: "Running",
    sessions: [{
      session,
      runtime,
      title: "Provider settings refactor",
      active: true,
      pinned: false,
      archived: false,
      statusLabel: "Active",
    }],
  },
  {
    key: "attention",
    label: "Needs attention",
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
    label: "Recent",
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
  save: labels.save,
  cancel: labels.cancel,
  threadMenu: labels.threadMenu,
  localRuntime: labels.localRuntime,
  worktreeRuntime: labels.worktreeRuntime,
};

export function installVisualAppStub() {
  const visualApp = {
    GetProviderCatalogScope: async () => providerCatalog,
    SaveProviderCatalogScope: async (_scope: string, catalog: ProviderCatalog) => catalog,
    GetProviderCatalog: async () => providerCatalog,
    GetProviderSecretStatuses: async () => ({
      openai: { configured: true, available: true },
      deepseek: { configured: true, available: false },
    }),
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
  };

  Object.defineProperty(window, "go", {
    configurable: true,
    value: { main: { App: visualApp } },
  });
}
