import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { AppShell } from "../components/app-shell/AppShell";
import { WorkspaceTopbar } from "../components/app-shell/WorkspaceTopbar";
import type { InspectorTab } from "../components/inspector/Inspector";
import { WorkspaceInspector } from "../components/inspector/WorkspaceInspector";
import type { SidebarGroup } from "../components/sidebar/Sidebar";
import { WorkspaceSidebar } from "../components/sidebar/WorkspaceSidebar";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import type {
  Health,
  LSPDiagnostic,
  LSPStatus,
  Message,
  ProviderCatalog,
  RuntimeEvent,
  RuntimeKind,
  Session,
  SessionCheckpoint,
  SessionRuntime,
  SubagentNode,
  WorkflowSummary,
} from "../types";
import type { ConfiguredModelOption } from "./presentation-model";
import { WorkspaceOverlays } from "./WorkspaceOverlays";
import { WorkspaceRouteContent } from "./WorkspaceRouteContent";
import type { WorkspaceRoute } from "./workspace-route";

type Policy = "read-only" | "workspace" | "full";
type RuntimeState = "ready" | "online" | "offline";

type Props = {
  route: WorkspaceRoute;
  current?: Session;
  runtime: SessionRuntime;
  locale: Locale;
  labels: AppCopy;
  workspace: string;
  groups: SidebarGroup[];
  recentProjects: string[];
  selectedSessionId: string;
  runtimeState: RuntimeState;
  health?: Health;
  pressure: number;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  events: RuntimeEvent[];
  catalog: ProviderCatalog;
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
  cleanupWorktreeOpen: boolean;
  error: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onSetRoute: (route: WorkspaceRoute) => void;
  onSidebarOpenChange: (open: boolean) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onCleanupWorktreeOpenChange: (open: boolean) => void;
  onNewTask: () => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onSwitchLocale: () => void;
  onCatalogChange: (catalog: ProviderCatalog) => void;
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
  onCleanupWorktree: (force: boolean) => void;
};

export function WorkspaceView(props: Props) {
  const {
    route,
    current,
    runtime,
    locale,
    labels,
    workspace,
    groups,
    recentProjects,
    selectedSessionId,
    runtimeState,
    health,
    pressure,
    sidebarOpen,
    inspectorOpen,
    inspectorTab,
    events,
    catalog,
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
    cleanupWorktreeOpen,
    error,
    textareaRef,
  } = props;

  const modelSelectOptions = configuredModels.map((item) => ({
    value: item.ref,
    label: item.label,
    description: item.description,
    group: item.group,
  }));

  const openProviders = () => {
    props.onSetRoute({ kind: "providers" });
    props.onInspectorOpenChange(false);
    props.onSidebarOpenChange(false);
  };

  const openExtensions = () => {
    props.onSetRoute({ kind: "extensions", sessionId: selectedSessionId || undefined });
    props.onInspectorOpenChange(false);
    props.onSidebarOpenChange(false);
  };

  const sidebar = (
    <WorkspaceSidebar
      open={sidebarOpen}
      workspace={workspace}
      groups={groups}
      recentProjects={recentProjects}
      selectedSessionId={
        route.kind === "thread" || route.kind === "review" || route.kind === "extensions"
          ? selectedSessionId
          : ""
      }
      providerActive={route.kind === "providers"}
      extensionsActive={route.kind === "extensions"}
      runtimeState={runtimeState}
      runtimeVersion={health?.version}
      labels={labels}
      onClose={() => props.onSidebarOpenChange(false)}
      onNewTask={props.onNewTask}
      onPickWorkspace={props.onPickWorkspace}
      onOpenWorkspace={props.onOpenWorkspace}
      onSelectSession={(sessionId) => {
        props.onSetRoute({ kind: "thread", sessionId });
        props.onSidebarOpenChange(false);
      }}
      onRenameSession={props.onRenameSession}
      onPinSession={props.onPinSession}
      onArchiveSession={props.onArchiveSession}
      onOpenProviders={openProviders}
      onOpenExtensions={openExtensions}
      onSwitchLocale={props.onSwitchLocale}
    />
  );

  const inspector = route.kind === "thread" || route.kind === "new-task" ? (
    <WorkspaceInspector
      tab={inspectorTab}
      events={events}
      modelRef={modelRef}
      models={modelSelectOptions}
      policy={policy}
      maxSteps={maxSteps}
      health={health}
      pressure={pressure}
      command={command}
      lspCommand={lspCommand}
      lspArgs={lspArgs}
      lspLanguage={lspLanguage}
      lspStatus={lspStatus}
      lspDiagnosticPath={lspDiagnosticPath}
      lspDiagnostics={lspDiagnostics}
      subagents={subagents}
      checkpoints={checkpoints}
      workspaceOpen={Boolean(workspace)}
      selectedSessionId={selectedSessionId}
      running={running}
      busy={busy}
      labels={labels}
      onTabChange={props.onInspectorTabChange}
      onClose={() => props.onInspectorOpenChange(false)}
      onModelChange={props.onModelChange}
      onOpenProviders={openProviders}
      onPolicyChange={props.onPolicyChange}
      onMaxStepsChange={props.onMaxStepsChange}
      onCommandChange={props.onCommandChange}
      onLSPCommandChange={props.onLSPCommandChange}
      onLSPDiagnosticPathChange={props.onLSPDiagnosticPathChange}
      onRefreshLSPDiagnostics={props.onRefreshLSPDiagnostics}
      onLSPArgsChange={props.onLSPArgsChange}
      onLSPLanguageChange={props.onLSPLanguageChange}
      onStartLSP={props.onStartLSP}
      onStopLSP={props.onStopLSP}
      onOpenSubagent={(sessionId) => {
        props.onSetRoute({ kind: "thread", sessionId });
        props.onInspectorOpenChange(true);
        props.onInspectorTabChange("run");
      }}
      onRunShell={props.onRunShell}
    />
  ) : undefined;

  return (
    <>
      <AppShell
        sidebar={sidebar}
        sidebarOpen={sidebarOpen}
        inspectorOpen={inspectorOpen && (route.kind === "thread" || route.kind === "new-task")}
        inspector={inspector}
        closeLabel={labels.close}
        onCloseSidebar={() => props.onSidebarOpenChange(false)}
      >
        <WorkspaceTopbar
          route={route}
          current={current}
          workspace={workspace}
          runtime={runtime}
          running={running}
          busy={busy}
          inspectorOpen={inspectorOpen}
          labels={labels}
          onOpenSidebar={() => props.onSidebarOpenChange(true)}
          onBackToWorkspace={() => {
            props.onSetRoute(
              route.kind === "extensions" && current
                ? { kind: "thread", sessionId: current.id }
                : { kind: "new-task" },
            );
          }}
          onOpenReview={() => {
            if (!current) return;
            props.onSetRoute({ kind: "review", sessionId: current.id });
            props.onInspectorOpenChange(false);
          }}
          onOpenThread={() => {
            if (current) props.onSetRoute({ kind: "thread", sessionId: current.id });
          }}
          onCleanupWorktree={() => props.onCleanupWorktreeOpenChange(true)}
          onCancelAgent={props.onCancelAgent}
          onStartAgent={props.onStartAgent}
          onToggleInspector={() => props.onInspectorOpenChange(!inspectorOpen)}
        />

        <WorkspaceRouteContent
          route={route}
          current={current}
          runtime={runtime}
          locale={locale}
          labels={labels}
          workspace={workspace}
          recentProjects={recentProjects}
          catalog={catalog}
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
          onCatalogChange={props.onCatalogChange}
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
      </AppShell>

      <WorkspaceOverlays
        cleanupOpen={cleanupWorktreeOpen}
        busy={busy}
        error={error}
        labels={labels}
        onCleanupOpenChange={props.onCleanupWorktreeOpenChange}
        onCleanup={props.onCleanupWorktree}
        onClearError={props.onClearError}
      />
    </>
  );
}
