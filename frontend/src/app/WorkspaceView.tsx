import { useMemo, type FormEvent, type ReactNode, type Ref } from "react";
import { CommandPalette } from "../components/app-shell/CommandPalette";
import { Welcome } from "../components/app-shell/Welcome";
import type { InspectorTab } from "../components/inspector/inspector-types";
import { OmpImportDialog } from "../components/omp/OmpImportDialog";
import type { OmpImportSheet } from "./hooks/useWorkspaceController";
import { SettingsSheet } from "../components/settings/SettingsSheet";
import type { RuntimeState, SidebarGroup } from "../components/sidebar/Sidebar";
import type { WorktreeCleanupTarget } from "../components/worktree/WorktreeCleanupDialog";
import { presentError } from "../lib/error-presentation";
import { sessionRuntime } from "../lib/session-runtime";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import type { LayoutPreference } from "../lib/layout-preference";
import type { ThemePreference } from "../lib/theme";
import type {
  AgentEffort, AgentPolicy, ConfigState, Delegation, Health, LSPDiagnostic, LSPStatus, Message,
  RuntimeEvent, RuntimeKind, Session, SessionCheckpoint, SessionRuntime,
  SubagentNode, WorkflowSummary,
} from "../types";
import type { AgentCatalogController } from "./hooks/useAgentCatalog";
import type { ConfiguredModelOption, ModelPickerOption } from "./model-selection";
import { WorkspaceChrome } from "./WorkspaceChrome";
import { WorkspaceOverlays } from "./WorkspaceOverlays";
import { WorkspaceRouteContent } from "./WorkspaceRouteContent";
import { useWorkspacePages } from "./useWorkspacePages";
import { useWorkspaceCommands, type SettingsState } from "./useWorkspaceCommands";
import type { WorkspaceRoute } from "./workspace-route";

type Props = {
  route: WorkspaceRoute;
  current?: Session;
  parent?: Session;
  runtime: SessionRuntime;
  locale: Locale;
  labels: AppCopy;
  themePreference: ThemePreference;
  workspace: string;
  sessions: Session[];
  groups: SidebarGroup[];
  recentProjects: string[];
  selectedSessionId: string;
  runtimeState: RuntimeState;
  health?: Health;
  pressure: number;
  layout: LayoutPreference;
  sidebarDrawerOpen: boolean;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  settings: SettingsState;
  paletteOpen: boolean;
  events: RuntimeEvent[];
  config: ConfigState;
  agents: AgentCatalogController;
  trusting: boolean;
  modelRef: string;
  configuredModels: ConfiguredModelOption[];
  pickerModels: ModelPickerOption[];
  recentModelRefs: string[];
  effort?: AgentEffort;
  effortOptions: string[];
  maxSteps: number;
  contextPaths: string[];
  policy: AgentPolicy;
  runtimeKind: RuntimeKind;
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
  ompImport: OmpImportSheet;
  textareaRef: Ref<HTMLTextAreaElement>;
  onSetRoute: (route: WorkspaceRoute) => void;
  onLayoutChange: (layout: LayoutPreference) => void;
  onSidebarDrawerOpenChange: (open: boolean) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onSettingsChange: (settings: SettingsState) => void;
  onPaletteOpenChange: (open: boolean) => void;
  onWorktreeCleanupTargetChange: (target: WorktreeCleanupTarget | null) => void;
  onWorktreeCleanupCompleted: (deletedSessionIds: string[]) => void;
  onNewTask: () => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onLocaleChange: (locale: Locale) => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  onConfigChanged: () => void;
  onTrustWorkspace: () => void;
  onMigrateSubagentModel: () => void;
  onModelChange: (value: string) => void;
  onEffortChange: (effort: AgentEffort | undefined) => void;
  onError: (message: string) => void;
  onClearError: () => void;
  onPolicyChange: (value: AgentPolicy) => void;
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
  onSendReviewInstruction: (path: string, instruction: string) => Promise<void>;
  onRefreshThread: (sessionId: string) => Promise<void>;
  onDelegationChange: (sessionId: string, delegation: Delegation) => void;
};

export function WorkspaceView(props: Props) {
  const { route, current, labels, workspace, groups, settings, error } = props;
  const sessionIds = useMemo(() => new Set(props.sessions.map((session) => session.id)), [props.sessions]);

  const { navigate, openSettings, closeSettings, paletteActions, recovery } = useWorkspaceCommands({ ...props, sessionIds });
  const page = useWorkspacePages(props);

  const overlays: ReactNode = (
    <>
      {settings.mounted && (
        <SettingsSheet
          open={settings.open}
          pane={settings.pane}
          locale={props.locale}
          labels={labels}
          themePreference={props.themePreference}
          workspace={workspace}
          config={props.config}
          trusting={props.trusting}
          health={props.health}
          sessionId={current?.id || ""}
          runtime={props.runtime}
          onPaneChange={(pane) => props.onSettingsChange({ ...settings, pane })}
          onClose={closeSettings}
          onLocaleChange={props.onLocaleChange}
          onThemePreferenceChange={props.onThemePreferenceChange}
          onTrust={props.onTrustWorkspace}
          onConfigChanged={props.onConfigChanged}
          onError={props.onError}
        />
      )}
      {props.paletteOpen && (
        <CommandPalette
          labels={labels}
          groups={groups}
          actions={paletteActions}
          onOpenThread={(sessionId) => props.onSetRoute({ kind: "thread", sessionId })}
          onClose={() => props.onPaletteOpenChange(false)}
        />
      )}
      <WorkspaceOverlays
        worktreeCleanupTarget={props.worktreeCleanupTarget}
        error={presentError(labels, error)}
        labels={labels}
        onWorktreeCleanupClose={() => props.onWorktreeCleanupTargetChange(null)}
        onWorktreeCleanupCompleted={props.onWorktreeCleanupCompleted}
        errorActionLabel={recovery?.label}
        onErrorAction={recovery?.run}
        onClearError={props.onClearError}
      />
      <OmpImportDialog
        open={props.ompImport.open} labels={labels} locale={props.locale}
        onClose={() => props.ompImport.setOpen(false)} onImported={props.ompImport.openSession}
        onOpenPlugins={() => { props.ompImport.setOpen(false); openSettings("plugins"); }}
      />
    </>
  );

  if (!workspace) {
    return (
      <div className="lc-window is-welcome">
        <header className="toolbar drag-region"><div className="toolbar-lead" /></header>
        <Welcome
          labels={labels}
          recentProjects={props.recentProjects}
          busy={props.busy}
          online={props.runtimeState !== "offline"}
          onPickWorkspace={props.onPickWorkspace}
          onOpenWorkspace={props.onOpenWorkspace}
        />
        {overlays}
      </div>
    );
  }

  const attention = groups.find((group) => group.key === "attention")?.sessions.length ?? 0;
  const worktrees = props.sessions.filter((session) => sessionRuntime(session, workspace).kind === "worktree").length;

  return (
    <WorkspaceChrome
      pageSidebar={page.sidebar}
      route={route}
      current={current}
      parent={props.parent}
      runtime={props.runtime}
      locale={props.locale}
      labels={labels}
      workspace={workspace}
      groups={groups}
      recentProjects={props.recentProjects}
      selectedSessionId={props.selectedSessionId}
      attention={attention}
      worktrees={worktrees}
      health={props.health}
      pressure={props.pressure}
      layout={props.layout}
      sidebarDrawerOpen={props.sidebarDrawerOpen}
      inspectorOpen={props.inspectorOpen}
      inspectorTab={props.inspectorTab}
      settingsOpen={settings.open}
      events={props.events}
      modelRef={props.modelRef}
      configuredModels={props.configuredModels}
      policy={props.policy}
      maxSteps={props.maxSteps}
      command={props.command}
      lspCommand={props.lspCommand}
      lspArgs={props.lspArgs}
      lspLanguage={props.lspLanguage}
      lspStatus={props.lspStatus}
      lspDiagnosticPath={props.lspDiagnosticPath}
      lspDiagnostics={props.lspDiagnostics}
      subagents={props.subagents}
      checkpoints={props.checkpoints}
      running={props.running}
      busy={props.busy}
      configKey={props.config.globalDigest}
      trusting={props.trusting}
      overlays={overlays}
      onSetRoute={props.onSetRoute}
      onNavigate={navigate}
      onLayoutChange={props.onLayoutChange}
      onSidebarDrawerOpenChange={props.onSidebarDrawerOpenChange}
      onInspectorOpenChange={props.onInspectorOpenChange}
      onInspectorTabChange={props.onInspectorTabChange}
      onOpenSettings={() => openSettings(settings.pane)}
      onOpenProviders={() => openSettings("models")}
      onOpenPalette={() => props.onPaletteOpenChange(true)}
      onNewTask={props.onNewTask}
      onImportOmp={() => props.ompImport.setOpen(true)}
      onPickWorkspace={props.onPickWorkspace}
      onOpenWorkspace={props.onOpenWorkspace}
      onRenameSession={props.onRenameSession}
      onPinSession={props.onPinSession}
      onArchiveSession={props.onArchiveSession}
      onDeleteSession={(sessionId) => props.onWorktreeCleanupTargetChange({ mode: "delete", sessionId })}
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
      onTrustWorkspace={props.onTrustWorkspace}
      onCleanupWorktree={() => current && props.onWorktreeCleanupTargetChange({ mode: "remove", sessionId: current.id })}
      onCancelAgent={props.onCancelAgent}
      onStartAgent={props.onStartAgent}
    >
      <WorkspaceRouteContent
        pageContent={page.content}
        route={route}
        current={current}
        runtime={props.runtime}
        labels={labels}
        workspace={workspace}
        config={props.config}
        agents={props.agents}
        trusting={props.trusting}
        modelRef={props.modelRef}
        pickerModels={props.pickerModels}
        recentModelRefs={props.recentModelRefs}
        agent={props.agents.composerAgent}
        effort={props.effort}
        effortOptions={props.effortOptions}
        contextPaths={props.contextPaths}
        policy={props.policy}
        runtimeKind={props.runtimeKind}
        goal={props.goal}
        busy={props.busy}
        messages={props.messages}
        messageAtLatest={props.messageAtLatest}
        messageLoadingOlder={props.messageLoadingOlder}
        running={props.running}
        workflowSummary={props.workflowSummary}
        subagents={props.subagents}
        textareaRef={props.textareaRef}
        onTrustWorkspace={props.onTrustWorkspace}
        onModelChange={props.onModelChange}
        onEffortChange={props.onEffortChange}
        onGoalChange={props.onGoalChange}
        onPickContextFiles={props.onPickContextFiles}
        onPickContextFolder={props.onPickContextFolder}
        onRemoveContextPath={props.onRemoveContextPath}
        onPolicyChange={props.onPolicyChange}
        onRuntimeChange={props.onRuntimeChange}
        onPickWorkspace={props.onPickWorkspace}
        onOpenProviders={() => openSettings("models")}
        onApproveGate={props.onApproveGate}
        onLoadOlderMessages={props.onLoadOlderMessages}
        onJumpToLatest={props.onJumpToLatest}
        onCancel={props.onCancelAgent}
        onRetry={props.onRetry}
        onSubmit={props.onSubmit}
        onSendReviewInstruction={props.onSendReviewInstruction}
        events={props.events}
        onRefreshThread={props.onRefreshThread}
        onOpenSession={(sessionId) => props.onSetRoute({ kind: "thread", sessionId })}
        onDelegationChange={props.onDelegationChange}
      />
    </WorkspaceChrome>
  );
}
