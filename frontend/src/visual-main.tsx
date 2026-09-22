import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { Menu, PanelRight } from "lucide-react";
import { WorkspaceExtensionsRoute } from "./app/WorkspaceExtensionsRoute";
import { WorkspaceReviewRoute } from "./app/WorkspaceReviewRoute";
import { AppShell } from "./components/app-shell/AppShell";
import { NewTaskComposer } from "./components/composer/NewTaskComposer";
import { WorkspaceInspector } from "./components/inspector/WorkspaceInspector";
import { ProviderSettingsPanel } from "./components/provider/ProviderSettingsPanel";
import { Sidebar, type SidebarGroup } from "./components/sidebar/Sidebar";
import { ThreadWorkspace } from "./components/thread/ThreadWorkspace";
import { copy } from "./lib/i18n/app-copy";
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
} from "./types";
import "./styles/tokens.css";
import "./styles/global.css";
import "./components/primitives/primitives.css";
import "./components/sidebar/sidebar.css";
import "./components/inspector/inspector.css";
import "./styles.css";

type VisualScene = "new-task" | "thread" | "providers" | "review" | "extensions" | "inspector";

const noop = () => undefined;
const labels = copy.en;
const workspace = "/Users/demo/Projects/lumencortex";
const localRuntime: SessionRuntime = { kind: "local", path: workspace, branch: "main", head: "0f6c33a" };
const runtime: SessionRuntime = {
  kind: "worktree",
  path: "/Users/demo/Projects/.lumencortex-worktrees/session-demo",
  branch: "lumencortex/demo",
  base: "main",
  head: "98ab42f",
};

const session: Session = {
  id: "session-demo",
  createdAt: "2026-09-22T01:00:00Z",
  updatedAt: "2026-09-22T02:00:00Z",
  status: "running",
  provider: "openai",
  model: "gpt-5.6",
  goal: "Refactor provider settings and add tests without changing public behavior",
};

const messages: Message[] = [
  { sessionId: session.id, seq: 0, role: "user", json: { content: "Refactor provider settings and add tests." } },
  { sessionId: session.id, seq: 1, role: "assistant", json: { content: "I’ll inspect the provider configuration and existing tests first." } },
  { sessionId: session.id, seq: 2, role: "tool", json: { name: "search_text", content: JSON.stringify({ path: "internal/backend/provider_config.go", ok: true }) } },
  { sessionId: session.id, seq: 3, role: "assistant", json: { content: "The project already separates global and project scopes. I’ll preserve that contract." } },
];

const reviewMessages: Message[] = [
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

const providerCatalog: ProviderCatalog = {
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

const visualMCPConfig = {
  id: "filesystem",
  name: "Filesystem Tools",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", workspace],
  protocolMode: "modern" as const,
  disabled: false,
};

const visualEvents: RuntimeEvent[] = [
  { seq: 1, at: "2026-09-22T01:02:00Z", type: "run.started", sessionId: session.id, data: {} },
  { seq: 2, at: "2026-09-22T01:03:00Z", type: "worktree.created", sessionId: session.id, data: { branch: runtime.branch } },
  { seq: 3, at: "2026-09-22T01:05:00Z", type: "tool.end", sessionId: session.id, data: { name: "search_text", path: "frontend/src", exitCode: 0 } },
  { seq: 4, at: "2026-09-22T01:08:00Z", type: "workflow.transition", sessionId: session.id, data: { title: "Refactor provider settings" } },
  { seq: 5, at: "2026-09-22T01:11:00Z", type: "subagent.spawned", sessionId: session.id, data: { goal: "Review provider tests" } },
  { seq: 6, at: "2026-09-22T01:16:00Z", type: "tool.end", sessionId: session.id, data: { name: "shell", command: "npm test", exitCode: 0 } },
];

const health: Health = {
  version: "0.1.0",
  workspace,
  database: "/Users/demo/Library/Application Support/LumenCortex/lumencortex.db",
  budget: { softBytes: 67108864, hardBytes: 134217728, maxAgents: 4 },
  usedBytes: 24117248,
  activeAgents: 1,
  pressure: false,
};

const lspStatus: LSPStatus = {
  running: true,
  name: "typescript-language-server",
  command: "typescript-language-server",
  pid: 42117,
  pendingRequests: 0,
  diagnostics: 2,
};

const subagents: SubagentNode[] = [{
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

const checkpoints: SessionCheckpoint[] = [{
  sessionId: session.id,
  seq: 4,
  at: "2026-09-22T01:08:00Z",
  reason: "workflow",
  json: { action: "refactor-provider" },
}];

const groups: SidebarGroup[] = [
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

const sidebarLabels = {
  close: labels.close,
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

const visualApp = {
  GetProviderCatalogScope: async () => providerCatalog,
  SaveProviderCatalogScope: async (_scope: string, catalog: ProviderCatalog) => catalog,
  GetProviderCatalog: async () => providerCatalog,
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
};

(window as typeof window & { go: unknown }).go = { main: { App: visualApp } };

function Topbar({
  onOpenSidebar,
  title,
  subtitle,
  inspectorActive = false,
}: {
  onOpenSidebar: () => void;
  title: string;
  subtitle: string;
  inspectorActive?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button sidebar-toggle" onClick={onOpenSidebar} aria-label="Open sidebar">
          <Menu size={16} strokeWidth={1.7} aria-hidden />
        </button>
        <div className="title-stack">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="topbar-actions">
        <button className={`icon-button ${inspectorActive ? "active" : ""}`} aria-label="Activity panel">
          <PanelRight size={16} strokeWidth={1.7} aria-hidden />
        </button>
      </div>
    </header>
  );
}

function sceneFromLocation(): VisualScene {
  const value = new URLSearchParams(window.location.search).get("scene");
  return value === "thread" ||
    value === "providers" ||
    value === "review" ||
    value === "extensions" ||
    value === "inspector"
    ? value
    : "new-task";
}

function ThreadScene({ goal, onGoalChange }: { goal: string; onGoalChange: (value: string) => void }) {
  return (
    <ThreadWorkspace
      session={session}
      runtime={runtime}
      messages={messages}
      hasOlderMessages
      historicalMessages={false}
      loadingOlderMessages={false}
      running
      statusLabel="Active"
      workspaceName="lumencortex"
      modelRef="openai/gpt-5.6"
      models={[{ value: "openai/gpt-5.6", label: "GPT-5.6" }]}
      policyLabel="Workspace"
      goal={goal}
      busy={false}
      workflowSummary={null}
      activeSubagents={1}
      textareaRef={null}
      labels={{
        newTask: labels.thread,
        running: labels.running,
        noMessages: labels.noMessages,
        finalAnswer: labels.finalAnswer,
        startAnother: labels.startAnother,
        composerPlaceholder: labels.composerPlaceholder,
        composerHint: labels.composerHint,
        noModels: labels.noModels,
        start: labels.start,
        roleUser: labels.messageRoleUser,
        roleAssistant: labels.messageRoleAssistant,
        roleTool: labels.messageRoleTool,
        roleSystem: labels.messageRoleSystem,
        approvalTitle: labels.approvalTitle,
        approve: labels.approve,
        loadEarlier: labels.loadEarlier,
        backToLatest: labels.backToLatest,
        historyWindow: labels.historyWindow,
        localRuntime: labels.localRuntime,
        worktreeRuntime: labels.worktreeRuntime,
        plan: labels.plan,
        planRunning: labels.planRunning,
        planWaiting: labels.planWaiting,
        planSubagents: labels.planSubagents,
        copy: labels.copy,
        copied: labels.copied,
        retry: labels.retry,
      }}
      onGoalChange={onGoalChange}
      onModelChange={noop}
      onApproveGate={noop}
      onLoadOlderMessages={noop}
      onJumpToLatest={noop}
      onCancel={noop}
      onRetry={noop}
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={noop}
    />
  );
}

function VisualFixture() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const scene = sceneFromLocation();
  const sessionScene = scene === "thread" || scene === "review" || scene === "inspector";

  const sidebar = (
    <Sidebar
      open={sidebarOpen}
      workspace={workspace}
      workspaceName="lumencortex"
      groups={groups}
      recentProjects={[workspace, "/Users/demo/Projects/runtime"]}
      selectedSessionId={sessionScene ? session.id : ""}
      providerActive={scene === "providers"}
      extensionsActive={scene === "extensions"}
      runtimeState="online"
      runtimeVersion="0.1.0"
      labels={sidebarLabels}
      onClose={() => setSidebarOpen(false)}
      onNewTask={noop}
      onPickWorkspace={noop}
      onOpenWorkspace={noop}
      onSelectSession={noop}
      onRenameSession={noop}
      onPinSession={noop}
      onArchiveSession={noop}
      onOpenProviders={noop}
      onOpenExtensions={noop}
      onSwitchLocale={noop}
    />
  );

  const inspector = scene === "inspector" ? (
    <WorkspaceInspector
      tab="activity"
      events={visualEvents}
      modelRef="openai/gpt-5.6"
      models={[{ value: "openai/gpt-5.6", label: "GPT-5.6", group: "OpenAI" }]}
      policy="workspace"
      maxSteps={24}
      health={health}
      pressure={18}
      command="npm test"
      lspCommand="typescript-language-server"
      lspArgs="--stdio"
      lspLanguage="typescript"
      lspStatus={lspStatus}
      lspDiagnosticPath="frontend/src/App.tsx"
      lspDiagnostics={[]}
      subagents={subagents}
      checkpoints={checkpoints}
      workspaceOpen
      selectedSessionId={session.id}
      running
      busy={false}
      labels={labels}
      onTabChange={noop}
      onClose={noop}
      onModelChange={noop}
      onOpenProviders={noop}
      onPolicyChange={noop}
      onMaxStepsChange={noop}
      onCommandChange={noop}
      onLSPCommandChange={noop}
      onLSPArgsChange={noop}
      onLSPLanguageChange={noop}
      onLSPDiagnosticPathChange={noop}
      onRefreshLSPDiagnostics={noop}
      onStartLSP={noop}
      onStopLSP={noop}
      onOpenSubagent={noop}
      onRunShell={(event) => event.preventDefault()}
    />
  ) : undefined;

  const topbarTitle =
    scene === "providers" ? labels.providerSettings :
    scene === "extensions" ? labels.extensions :
    scene === "review" ? labels.review :
    scene === "new-task" ? "lumencortex" :
    session.goal;
  const topbarSubtitle =
    scene === "providers" ? "Global & project configuration" :
    scene === "extensions" ? "MCP · Skills · Permissions" :
    scene === "review" ? "3 changed files · Local" :
    scene === "new-task" ? "Local" :
    "Worktree · GPT-5.6 · Active";

  return (
    <AppShell
      sidebar={sidebar}
      sidebarOpen={sidebarOpen}
      inspectorOpen={scene === "inspector"}
      inspector={inspector}
      closeLabel={labels.close}
      onCloseSidebar={() => setSidebarOpen(false)}
    >
      <Topbar
        onOpenSidebar={() => setSidebarOpen(true)}
        title={topbarTitle}
        subtitle={topbarSubtitle}
        inspectorActive={scene === "inspector"}
      />

      {scene === "new-task" && (
        <NewTaskComposer
          title={labels.buildTitle}
          subtitle={labels.newTaskSubtitle}
          placeholder={labels.composerPlaceholder}
          workspace={workspace}
          workspaceName="lumencortex"
          recentProjects={[workspace, "/Users/demo/Projects/runtime"]}
          recentProjectsLabel={labels.recentProjects}
          chooseProjectLabel={labels.openProject}
          modelLabel={labels.modelSelect}
          modelRef="openai/gpt-5.6"
          models={[{ ref: "openai/gpt-5.6", label: "GPT-5.6", group: "OpenAI", description: "128K ctx" }]}
          noModelsLabel={labels.modelFallback}
          contextPaths={["frontend/src/App.tsx", "internal/backend"]}
          contextLabels={{
            context: labels.context,
            files: labels.attachFiles,
            folder: labels.attachFolder,
            remove: labels.removeContext,
          }}
          policyLabel={labels.policy}
          policy="workspace"
          policyLabels={{ "read-only": labels.readOnly, workspace: labels.workspace, full: labels.full }}
          environmentLabel={labels.environment}
          runtime="worktree"
          runtimeLabels={{ local: labels.localRuntime, worktree: labels.worktreeRuntime }}
          runtimeDescriptions={{
            local: labels.localRuntimeDescription,
            worktree: labels.worktreeRuntimeDescription,
          }}
          hint={labels.composerHint}
          startLabel={labels.start}
          goal={goal}
          busy={false}
          textareaRef={null}
          onGoalChange={setGoal}
          onModelChange={noop}
          onPickContextFiles={noop}
          onPickContextFolder={noop}
          onRemoveContextPath={noop}
          onPolicyChange={noop}
          onRuntimeChange={noop}
          onPickWorkspace={noop}
          onOpenWorkspace={noop}
          onOpenProviders={noop}
          onSubmit={(event) => event.preventDefault()}
          onKeyDown={noop}
        />
      )}

      {(scene === "thread" || scene === "inspector") && (
        <ThreadScene goal={goal} onGoalChange={setGoal} />
      )}

      {scene === "providers" && (
        <ProviderSettingsPanel
          locale="en"
          workspace={workspace}
          effectiveCatalog={providerCatalog}
          selectedModelRef="openai/gpt-5.6"
          onSelectedModelRef={noop}
          onEffectiveCatalogChange={noop}
          onError={noop}
        />
      )}

      {scene === "review" && (
        <WorkspaceReviewRoute
          session={session}
          runtime={localRuntime}
          messages={reviewMessages}
          busy={false}
          running={false}
          labels={labels}
          onSendInstruction={async () => undefined}
        />
      )}

      {scene === "extensions" && (
        <WorkspaceExtensionsRoute
          workspace={workspace}
          sessionId={session.id}
          runtime={localRuntime}
          labels={labels}
          onError={noop}
        />
      )}
    </AppShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VisualFixture />
  </React.StrictMode>
);
