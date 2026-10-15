import type { FormEvent, KeyboardEvent, Ref } from "react";
import type { InspectorTab } from "../components/inspector/inspector-types";
import type { SidebarGroup } from "../components/sidebar/Sidebar";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import type { ThemePreference } from "../lib/theme";
import type {
  Health,
  LSPDiagnostic,
  LSPStatus,
  Message,
  ConfigState,
  RuntimeEvent,
  RuntimeKind,
  Session,
  SessionCheckpoint,
  SessionRuntime,
  SubagentNode,
  WorkflowSummary,
} from "../types";
import { presentError } from "../lib/error-presentation";
import { errorRecoveryKind } from "./error-recovery";
import type { ConfiguredModelOption } from "./model-selection";
import { WorkspaceChrome } from "./WorkspaceChrome";
import { WorkspaceOverlays } from "./WorkspaceOverlays";
import { WorkspaceRouteContent } from "./WorkspaceRouteContent";
import type { WorkspaceRoute } from "./workspace-route";
import type { WorktreeCleanupTarget } from "../components/worktree/WorktreeCleanupDialog";

type Policy = "read-only" | "workspace" | "full";
type RuntimeState = "ready" | "online" | "offline";

type Props = {
  route: WorkspaceRoute;
  current?: Session;
  runtime: SessionRuntime;
  locale: Locale;
  labels: AppCopy;
  themePreference: ThemePreference;
  workspace: string;
  groups: SidebarGroup[];
  recentProjects: string[];
  selectedSessionId: string;
  runtimeState: RuntimeState;
  health?: Health;
  pressure: number;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  events: RuntimeEvent[];
  config: ConfigState;
  trusting: boolean;
  modelRef: string;
  configuredModels: ConfiguredModelOption[];
  contextPaths: string[];
  policy: Policy;
  runtimeKind: RuntimeKind;
  maxSteps: number;
  command: string;
  lspCommand: string;
  lspArgs: string;
  lspLanguage: string;
  lspStatus: LSPStatus;
  lspDiagnosticPath: string;
  lspDiagnostics: LSPDiagnostic[];
  messages: Message[];
  messageAtLatest: boolean;
  messageLoadingOlder: boolean;
  running: boolean;
  busy: boolean;
  goal: string;
  workflowSummary: WorkflowSummary | null;
  subagents: SubagentNode[];
  checkpoints: SessionCheckpoint[];
  worktreeCleanupTarget: WorktreeCleanupTarget | null;
  error: string;
  textareaRef: Ref<HTMLTextAreaElement>;
  onSetRoute: (route: WorkspaceRoute) => void;
  onSidebarOpenChange: (open: boolean) => void;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onWorktreeCleanupTargetChange: (target: WorktreeCleanupTarget | null) => void;
  onWorktreeCleanupCompleted: (deletedSessionIds: string[]) => void;
  onNewTask: () => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onSwitchLocale: () => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  onConfigChanged: () => void;
  onTrustWorkspace: () => void;
  onModelChange: (value: string) => void;
  onError: (message: string) => void;
  onClearError: () => void;
  onPolicyChange: (value: Policy) => void;
  onRuntimeChange: (value: RuntimeKind) => void;
  onMaxStepsChange: (value: number) => void;
  onCommandChange: (value: string) => void;
  onLSPCommandChange: (value: string) => void;
  onLSPArgsChange: (value: string) => void;
  onLSPLanguageChange: (value: string) => void;
  onLSPDiagnosticPathChange: (value: string) => void;
  onRefreshLSPDiagnostics: () => void;
  onStartLSP: () => void;
  onStopLSP: () => void;
  onOpenSubagent: (sessionId: string) => void;
  onRunShell: (event: FormEvent<HTMLFormElement>) => void;
  onGoalChange: (value: string) => void;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  onApproveGate: (gateId: string) => void;
  onLoadOlderMessages: () => void;
  onJumpToLatest: () => void;
  onCancelAgent: () => void;
  onRetry: () => void;
  onStartAgent: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendReviewInstruction: (path: string, instruction: string) => Promise<void>;
};

export function WorkspaceView(props: Props) {
  const {
    route,
    current,
    runtime,
    locale,
    labels,
    themePreference,
    workspace,
    groups,
    recentProjects,
    selectedSessionId,
    runtimeState,
    health,
    pressure,
    sidebarOpen,
    sidebarCollapsed,
    inspectorOpen,
    inspectorTab,
    events,
    config,
    trusting,
    modelRef,
    configuredModels,
    contextPaths,
    policy,
    runtimeKind,
    maxSteps,
    command,
    lspCommand,
    lspArgs,
    lspLanguage,
    lspStatus,
    lspDiagnosticPath,
    lspDiagnostics,
    messages,
    messageAtLatest,
    messageLoadingOlder,
    running,
    busy,
    goal,
    workflowSummary,
    subagents,
    checkpoints,
    worktreeCleanupTarget,
    error,
    textareaRef,
  } = props;

  const openProviders = () => {
    props.onSetRoute({ kind: "providers" });
    props.onInspectorOpenChange(false);
    props.onSidebarOpenChange(false);
  };

  const recoveryKind = errorRecoveryKind(error);
  const recoveryLabel =
    recoveryKind === "provider"
      ? labels.providerConfig
      : recoveryKind === "permissions"
        ? labels.permissions
        : recoveryKind === "workspace"
          ? (workspace ? labels.reopenProject : labels.openProject)
          : undefined;

  const recoverError = recoveryKind ? () => {
    props.onClearError();
    if (recoveryKind === "provider") {
      openProviders();
    } else if (recoveryKind === "permissions") {
      if (route.kind !== "new-task" && route.kind !== "thread") {
        props.onSetRoute(current ? { kind: "thread", sessionId: current.id } : { kind: "new-task" });
      }
      props.onInspectorTabChange("run");
      props.onInspectorOpenChange(true);
    } else if (workspace) {
      props.onOpenWorkspace(workspace);
    } else {
      props.onPickWorkspace();
    }
  } : undefined;

  return (
    <>
      <WorkspaceChrome
        route={route}
        current={current}
        runtime={runtime}
        labels={labels}
        themePreference={themePreference}
        workspace={workspace}
        groups={groups}
        recentProjects={recentProjects}
        selectedSessionId={selectedSessionId}
        runtimeState={runtimeState}
        health={health}
        pressure={pressure}
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        inspectorOpen={inspectorOpen}
        inspectorTab={inspectorTab}
        events={events}
        modelRef={modelRef}
        configuredModels={configuredModels}
        policy={policy}
        maxSteps={maxSteps}
        command={command}
        lspCommand={lspCommand}
        lspArgs={lspArgs}
        lspLanguage={lspLanguage}
        lspStatus={lspStatus}
        lspDiagnosticPath={lspDiagnosticPath}
        lspDiagnostics={lspDiagnostics}
        subagents={subagents}
        checkpoints={checkpoints}
        running={running}
        busy={busy}
        onSetRoute={props.onSetRoute}
        onSidebarOpenChange={props.onSidebarOpenChange}
        onSidebarCollapsedChange={props.onSidebarCollapsedChange}
        onInspectorOpenChange={props.onInspectorOpenChange}
        onInspectorTabChange={props.onInspectorTabChange}
        onNewTask={props.onNewTask}
        onPickWorkspace={props.onPickWorkspace}
        onOpenWorkspace={props.onOpenWorkspace}
        onRenameSession={props.onRenameSession}
        onPinSession={props.onPinSession}
        onArchiveSession={props.onArchiveSession}
        onDeleteSession={(sessionId) => props.onWorktreeCleanupTargetChange({ mode: "delete", sessionId })}
        onSwitchLocale={props.onSwitchLocale}
        onThemePreferenceChange={props.onThemePreferenceChange}
        onModelChange={props.onModelChange}
        onPolicyChange={props.onPolicyChange}
        onMaxStepsChange={props.onMaxStepsChange}
        onCommandChange={props.onCommandChange}
        onLSPCommandChange={props.onLSPCommandChange}
        onLSPArgsChange={props.onLSPArgsChange}
        onLSPLanguageChange={props.onLSPLanguageChange}
        onLSPDiagnosticPathChange={props.onLSPDiagnosticPathChange}
        onRefreshLSPDiagnostics={props.onRefreshLSPDiagnostics}
        onStartLSP={props.onStartLSP}
        onStopLSP={props.onStopLSP}
        onOpenSubagent={props.onOpenSubagent}
        onRunShell={props.onRunShell}
        onCleanupWorktree={() => current && props.onWorktreeCleanupTargetChange({ mode: "remove", sessionId: current.id })}
        onCancelAgent={props.onCancelAgent}
        onStartAgent={props.onStartAgent}
      >
        <WorkspaceRouteContent
          route={route}
          current={current}
          runtime={runtime}
          locale={locale}
          labels={labels}
          workspace={workspace}
          recentProjects={recentProjects}
          config={config}
          trusting={trusting}
          modelRef={modelRef}
          configuredModels={configuredModels}
          contextPaths={contextPaths}
          policy={policy}
          runtimeKind={runtimeKind}
          goal={goal}
          busy={busy}
          messages={messages}
          messageAtLatest={messageAtLatest}
          messageLoadingOlder={messageLoadingOlder}
          running={running}
          workflowSummary={workflowSummary}
          subagents={subagents}
          textareaRef={textareaRef}
          onConfigChanged={props.onConfigChanged}
          onTrustWorkspace={props.onTrustWorkspace}
          onModelChange={props.onModelChange}
          onError={props.onError}
          onGoalChange={props.onGoalChange}
          onPickContextFiles={props.onPickContextFiles}
          onPickContextFolder={props.onPickContextFolder}
          onRemoveContextPath={props.onRemoveContextPath}
          onPolicyChange={props.onPolicyChange}
          onRuntimeChange={props.onRuntimeChange}
          onPickWorkspace={props.onPickWorkspace}
          onOpenWorkspace={props.onOpenWorkspace}
          onOpenProviders={openProviders}
          onApproveGate={props.onApproveGate}
          onLoadOlderMessages={props.onLoadOlderMessages}
          onJumpToLatest={props.onJumpToLatest}
          onCancel={props.onCancelAgent}
          onRetry={props.onRetry}
          onSubmit={props.onSubmit}
          onKeyDown={props.onKeyDown}
          onSendReviewInstruction={props.onSendReviewInstruction}
        />
      </WorkspaceChrome>

      <WorkspaceOverlays
        worktreeCleanupTarget={worktreeCleanupTarget}
        error={presentError(labels, error)}
        labels={labels}
        onWorktreeCleanupClose={() => props.onWorktreeCleanupTargetChange(null)}
        onWorktreeCleanupCompleted={props.onWorktreeCleanupCompleted}
        errorActionLabel={recoveryLabel}
        onErrorAction={recoverError}
        onClearError={props.onClearError}
      />
    </>
  );

}
