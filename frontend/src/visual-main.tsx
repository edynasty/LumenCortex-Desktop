import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { Menu, PanelRight } from "lucide-react";
import { AppShell } from "./components/app-shell/AppShell";
import { NewTaskComposer } from "./components/composer/NewTaskComposer";
import { Sidebar, type SidebarGroup } from "./components/sidebar/Sidebar";
import { ThreadWorkspace } from "./components/thread/ThreadWorkspace";
import type { Message, Session, SessionRuntime } from "./types";
import "./styles/tokens.css";
import "./styles/global.css";
import "./components/primitives/primitives.css";
import "./styles.css";

const noop = () => undefined;
const workspace = "/Users/demo/Projects/lumencortex";
const runtime: SessionRuntime = { kind: "worktree", path: "/Users/demo/Projects/.lumencortex-worktrees/session-demo", branch: "lumencortex/demo", base: "HEAD" };
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
      runtime: { kind: "local", path: workspace },
      title: "Improve review diff rendering",
      active: false,
      pinned: false,
      archived: false,
      statusLabel: "Completed",
    }],
  },
];

const sidebarLabels = {
  close: "Close",
  newTask: "New task",
  project: "Project",
  openProject: "Open project",
  sessions: "Threads",
  noSessions: "No threads yet",
  threadSearch: "Search threads",
  recentProjects: "Recent projects",
  providerSettings: "Models & providers",
  extensions: "Extensions",
  language: "中文",
  runtimeReady: "Runtime ready",
  runtimeOnline: "Runtime online",
  runtimeOffline: "Runtime offline",
  renameThread: "Rename",
  pinThread: "Pin",
  unpinThread: "Unpin",
  archiveThread: "Archive",
  restoreThread: "Restore",
  save: "Save",
  cancel: "Cancel",
  threadMenu: "Thread menu",
  localRuntime: "Local",
  worktreeRuntime: "Worktree",
};

function Topbar({ onOpenSidebar, title, subtitle }: { onOpenSidebar: () => void; title: string; subtitle: string }) {
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
        <button className="icon-button" aria-label="Activity panel">
          <PanelRight size={16} strokeWidth={1.7} aria-hidden />
        </button>
      </div>
    </header>
  );
}

function VisualFixture() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const scene = new URLSearchParams(window.location.search).get("scene") === "thread" ? "thread" : "new-task";

  const sidebar = (
    <Sidebar
      open={sidebarOpen}
      workspace={workspace}
      workspaceName="lumencortex"
      groups={groups}
      recentProjects={[workspace, "/Users/demo/Projects/runtime"]}
      selectedSessionId={scene === "thread" ? session.id : ""}
      providerActive={false}
      extensionsActive={false}
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

  return (
    <AppShell
      sidebar={sidebar}
      sidebarOpen={sidebarOpen}
      inspectorOpen={false}
      closeLabel="Close"
      onCloseSidebar={() => setSidebarOpen(false)}
    >
      <Topbar
        onOpenSidebar={() => setSidebarOpen(true)}
        title={scene === "thread" ? session.goal : "lumencortex"}
        subtitle={scene === "thread" ? "Worktree · gpt-5.6 · Active" : "Local"}
      />
      {scene === "new-task" ? (
        <NewTaskComposer
          title="What should LumenCortex build?"
          subtitle="Describe the task, choose a project, model, and permission profile, then start."
          placeholder="Describe a coding task, e.g. fix login timeout and add tests"
          workspace={workspace}
          workspaceName="lumencortex"
          recentProjects={[workspace, "/Users/demo/Projects/runtime"]}
          recentProjectsLabel="Recent projects"
          chooseProjectLabel="Open project"
          modelLabel="Model"
          modelRef="openai/gpt-5.6"
          models={[{ ref: "openai/gpt-5.6", label: "GPT-5.6", group: "OpenAI", description: "128K ctx" }]}
          noModelsLabel="Environment model"
          contextPaths={["frontend/src/App.tsx", "internal/backend"]}
          contextLabels={{ context: "Context", files: "Attach files", folder: "Attach folder", remove: "Remove context" }}
          policyLabel="Permissions"
          policy="workspace"
          policyLabels={{ "read-only": "Read only", workspace: "Workspace", full: "Full access" }}
          environmentLabel="Run environment"
          runtime="worktree"
          runtimeLabels={{ local: "Local", worktree: "Worktree" }}
          runtimeDescriptions={{ local: "Run in the current project", worktree: "Create an isolated Git worktree" }}
          hint="Enter to start · Shift+Enter for a new line"
          startLabel="Start"
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
      ) : (
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
            newTask: "Task",
            running: "Running",
            noMessages: "No messages",
            finalAnswer: "Final result",
            startAnother: "Follow up",
            composerPlaceholder: "Follow up",
            composerHint: "Enter to send · Shift+Enter for a new line",
            noModels: "No models",
            start: "Start",
            roleUser: "You",
            roleAssistant: "LumenCortex",
            roleTool: "Tool",
            roleSystem: "System",
            approvalTitle: "Approval required",
            approve: "Approve",
            loadEarlier: "Load earlier",
            backToLatest: "Back to latest",
            historyWindow: "Viewing history",
            localRuntime: "Local",
            worktreeRuntime: "Worktree",
            plan: "Plan",
            planRunning: "Running",
            planWaiting: "Waiting",
            planSubagents: "subagents",
            copy: "Copy",
            copied: "Copied",
            retry: "Retry",
          }}
          onGoalChange={setGoal}
          onModelChange={noop}
          onApproveGate={noop}
          onLoadOlderMessages={noop}
          onJumpToLatest={noop}
          onCancel={noop}
          onRetry={noop}
          onSubmit={(event) => event.preventDefault()}
          onKeyDown={noop}
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
