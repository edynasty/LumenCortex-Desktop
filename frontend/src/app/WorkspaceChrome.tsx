import type { FormEvent, ReactNode } from "react";
import { AppShell } from "../components/app-shell/AppShell";
import { WorkspaceTopbar } from "../components/app-shell/WorkspaceTopbar";
import type { InspectorTab } from "../components/inspector/inspector-types";
import { WorkspaceInspector } from "../components/inspector/WorkspaceInspector";
import type { SidebarGroup } from "../components/sidebar/Sidebar";
import { WorkspaceSidebar } from "../components/sidebar/WorkspaceSidebar";
import type { AppCopy } from "../lib/i18n/app-copy";
import type { ThemePreference } from "../lib/theme";
import type {
  Health,
  LSPDiagnostic,
  LSPStatus,
  RuntimeEvent,
  Session,
  SessionCheckpoint,
  SessionRuntime,
  SubagentNode,
} from "../types";
import type { ConfiguredModelOption } from "./presentation-model";
import type { WorkspaceRoute } from "./workspace-route";

type Policy = "read-only" | "workspace" | "full";
type RuntimeState = "ready" | "online" | "offline";

type Props = {
  children: ReactNode;
  route: WorkspaceRoute;
  current?: Session;
  runtime: SessionRuntime;
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
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  events: RuntimeEvent[];
  modelRef: string;
  configuredModels: ConfiguredModelOption[];
  policy: Policy;
  maxSteps: number;
  command: string;
  lspCommand: string;
  lspArgs: string;
  lspLanguage: string;
  lspStatus: LSPStatus;
  lspDiagnosticPath: string;
  lspDiagnostics: LSPDiagnostic[];
  subagents: SubagentNode[];
  checkpoints: SessionCheckpoint[];
  running: boolean;
  busy: boolean;
  onSetRoute: (route: WorkspaceRoute) => void;
  onSidebarOpenChange: (open: boolean) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onNewTask: () => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onSwitchLocale: () => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  onModelChange: (value: string) => void;
  onPolicyChange: (value: Policy) => void;
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
  onCleanupWorktree: () => void;
  onCancelAgent: () => void;
  onStartAgent: () => void;
};

export function WorkspaceChrome(props: Props) {
  const {
    route,
    current,
    runtime,
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
    inspectorOpen,
    inspectorTab,
    events,
    modelRef,
    configuredModels,
    policy,
    maxSteps,
    command,
    lspCommand,
    lspArgs,
    lspLanguage,
    lspStatus,
    lspDiagnosticPath,
    lspDiagnostics,
    subagents,
    checkpoints,
    running,
    busy,
  } = props;

  const models = configuredModels.map((item) => ({
    value: item.ref,
    label: item.label,
    description: item.description,
    group: item.group,
    badge: item.isDefault ? labels.defaultModel : undefined,
  }));

  const openProviders = () => {
    props.onSetRoute({ kind: "providers" });
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
      themePreference={themePreference}
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
      onOpenExtensions={() => {
        props.onSetRoute({ kind: "extensions", sessionId: selectedSessionId || undefined });
        props.onInspectorOpenChange(false);
        props.onSidebarOpenChange(false);
      }}
      onSwitchLocale={props.onSwitchLocale}
      onThemePreferenceChange={props.onThemePreferenceChange}
    />
  );

  const inspector = route.kind === "thread" || route.kind === "new-task" ? (
    <WorkspaceInspector
      tab={inspectorTab}
      events={events}
      modelRef={modelRef}
      models={models}
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
      onOpenSubagent={props.onOpenSubagent}
      onRunShell={props.onRunShell}
    />
  ) : undefined;

  return (
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
        onCleanupWorktree={props.onCleanupWorktree}
        onCancelAgent={props.onCancelAgent}
        onStartAgent={props.onStartAgent}
        onToggleInspector={() => props.onInspectorOpenChange(!inspectorOpen)}
      />
      {props.children}
    </AppShell>
  );
}
