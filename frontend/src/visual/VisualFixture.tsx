import { useState } from "react";
import type { ThemePreference } from "../lib/theme";
import { Menu, PanelRight } from "lucide-react";
import { WorkspaceExtensionsRoute } from "../app/WorkspaceExtensionsRoute";
import { WorkspaceReviewRoute } from "../app/WorkspaceReviewRoute";
import { AppShell } from "../components/app-shell/AppShell";
import { NewTaskComposer } from "../components/composer/NewTaskComposer";
import { WorkspaceInspector } from "../components/inspector/WorkspaceInspector";
import { ProviderSettingsPanel } from "../components/provider/ProviderSettingsPanel";
import { Sidebar } from "../components/sidebar/Sidebar";
import { ThreadWorkspace } from "../components/thread/ThreadWorkspace";
import {
  checkpoints,
  groups,
  health,
  labels,
  localRuntime,
  lspStatus,
  messages,
  providerCatalog,
  reviewMessages,
  runtime,
  session,
  sidebarLabels,
  subagents,
  visualEvents,
  workspace,
  type VisualScene,
} from "./fixture-data";

const noop = () => undefined;

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

function InspectorFixture() {
  const [tab, setTab] = useState<"activity" | "run" | "terminal">("activity");
  return (
    <WorkspaceInspector
      tab={tab}
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
      onTabChange={setTab}
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
  );
}

export function VisualFixture() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const value = new URLSearchParams(window.location.search).get("theme");
    return value === "dark" || value === "light" ? value : "system";
  });
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
      themePreference={themePreference}
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
      onThemePreferenceChange={setThemePreference}
    />
  );

  const title =
    scene === "providers" ? labels.providerSettings :
    scene === "extensions" ? labels.extensions :
    scene === "review" ? labels.review :
    scene === "new-task" ? "lumencortex" :
    session.goal;
  const subtitle =
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
      inspector={scene === "inspector" ? <InspectorFixture /> : undefined}
      closeLabel={labels.close}
      onCloseSidebar={() => setSidebarOpen(false)}
    >
      <Topbar
        onOpenSidebar={() => setSidebarOpen(true)}
        title={title}
        subtitle={subtitle}
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
          contextLabels={{ context: labels.context, files: labels.attachFiles, folder: labels.attachFolder, remove: labels.removeContext }}
          policyLabel={labels.policy}
          policy="workspace"
          policyLabels={{ "read-only": labels.readOnly, workspace: labels.workspace, full: labels.full }}
          environmentLabel={labels.environment}
          runtime="worktree"
          runtimeLabels={{ local: labels.localRuntime, worktree: labels.worktreeRuntime }}
          runtimeDescriptions={{ local: labels.localRuntimeDescription, worktree: labels.worktreeRuntimeDescription }}
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

      {(scene === "thread" || scene === "inspector") && <ThreadScene goal={goal} onGoalChange={setGoal} />}

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
