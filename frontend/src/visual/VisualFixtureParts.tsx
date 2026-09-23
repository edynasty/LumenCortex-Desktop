import { useState } from "react";
import { Menu, PanelLeftOpen, PanelRight } from "lucide-react";
import { WorkspaceInspector } from "../components/inspector/WorkspaceInspector";
import { ThreadWorkspace } from "../components/thread/ThreadWorkspace";
import {
  checkpoints,
  health,
  labels,
  lspStatus,
  messages,
  runtime,
  session,
  subagents,
  visualEvents,
} from "./fixture-data";

const noop = () => undefined;

export function VisualTopbar({
  onOpenSidebar,
  onExpandSidebar,
  sidebarCollapsed,
  title,
  subtitle,
  inspectorActive = false,
}: {
  onOpenSidebar: () => void;
  onExpandSidebar: () => void;
  sidebarCollapsed: boolean;
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
        {sidebarCollapsed && (
          <button className="icon-button sidebar-expand-toggle" onClick={onExpandSidebar} aria-label="Expand sidebar">
            <PanelLeftOpen size={16} strokeWidth={1.7} aria-hidden />
          </button>
        )}
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

export function VisualThreadScene({
  goal,
  onGoalChange,
}: {
  goal: string;
  onGoalChange: (value: string) => void;
}) {
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
      models={[
        { value: "openai/gpt-5.6", label: "GPT-5.6", group: "OpenAI", description: "128K ctx · 16K out", badge: "Default" },
        { value: "deepseek/coder", label: "DeepSeek Coder", group: "DeepSeek", description: "64K ctx · 8K out", badge: "Missing key", badgeTone: "warning" },
      ]}
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
        modelSearch: labels.modelSearch,
        noModelMatches: labels.noModelMatches,
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

export function VisualInspectorFixture() {
  const [tab, setTab] = useState<"activity" | "run" | "terminal">("activity");
  return (
    <WorkspaceInspector
      tab={tab}
      events={visualEvents}
      modelRef="openai/gpt-5.6"
      models={[
        { value: "openai/gpt-5.6", label: "GPT-5.6", group: "OpenAI", description: "128K ctx · 16K out", badge: "Default" },
        { value: "deepseek/coder", label: "DeepSeek Coder", group: "DeepSeek", description: "64K ctx · 8K out", badge: "Missing key", badgeTone: "warning" },
      ]}
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
