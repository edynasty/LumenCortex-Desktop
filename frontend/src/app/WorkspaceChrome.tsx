import type { FormEvent, ReactNode } from "react";
import { AppShell } from "../components/app-shell/AppShell";
import { Rail } from "../components/app-shell/Rail";
import { WorkspaceTopbar } from "../components/app-shell/WorkspaceTopbar";
import type { InspectorTab, PolicyCeiling } from "../components/inspector/inspector-types";
import { WorkspaceInspector } from "../components/inspector/WorkspaceInspector";
import { Sidebar, type SidebarGroup } from "../components/sidebar/Sidebar";
import { ThreadsSidebar } from "../components/sidebar/ThreadsSidebar";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import type { LayoutPreference } from "../lib/layout-preference";
import type {
  Health,
  LSPDiagnostic,
  LSPStatus,
  PluginInfo,
  RuntimeEvent,
  Session,
  SessionCheckpoint,
  SessionRuntime,
  SubagentNode,
} from "../types";
import { useRunAnnouncement } from "./hooks/useRunAnnouncement";
import { pickerPlaceholder, type ConfiguredModelOption } from "./model-selection";
import { routePage, type WorkspacePage, type WorkspaceRoute } from "./workspace-route";

type Policy = "read-only" | "workspace" | "full";

type Props = {
  children: ReactNode;
  /** The Source Control / Context sidebar bodies; the Threads body is built here. */
  pageSidebar?: ReactNode;
  /** Window-level layers (settings sheet, palette, dialogs) rendered inside the window container. */
  overlays: ReactNode;
  route: WorkspaceRoute;
  current?: Session;
  parent?: Session;
  runtime: SessionRuntime;
  locale: Locale;
  labels: AppCopy;
  workspace: string;
  groups: SidebarGroup[];
  recentProjects: string[];
  missingProjects: string[];
  onRemoveRecentProject: (path: string) => void;
  selectedSessionId: string;
  attention: number;
  worktrees: number;
  /** Core's plugins, for the rail's pinned entries. */
  plugins: PluginInfo[];
  health?: Health;
  pressure: number;
  layout: LayoutPreference;
  sidebarDrawerOpen: boolean;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  settingsOpen: boolean;
  events: RuntimeEvent[];
  modelRef: string;
  configuredModels: ConfiguredModelOption[];
  policy: Policy;
  // The selected agent's permission ceiling, so the Run pane cannot offer a grant Core will cap.
  agentCeiling?: PolicyCeiling;
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
  configKey: string;
  trusting: boolean;
  onSetRoute: (route: WorkspaceRoute) => void;
  onNavigate: (page: WorkspacePage) => void;
  onLayoutChange: (layout: LayoutPreference) => void;
  onSidebarDrawerOpenChange: (open: boolean) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onOpenSettings: () => void;
  onOpenProviders: () => void;
  onOpenPalette: () => void;
  onNewTask: () => void;
  onOpenImport: (sourceId: string) => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
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
  onTrustWorkspace: () => void;
  onCleanupWorktree: () => void;
  onCancelAgent: () => void;
  onStartAgent: () => void;
};

export function WorkspaceChrome(props: Props) {
  const { route, current, labels, configuredModels } = props;
  const page = routePage(route);
  const inspectorAvailable = route.kind === "thread" || route.kind === "new-task";
  const closeDrawer = () => props.onSidebarDrawerOpenChange(false);
  const announcement = useRunAnnouncement(props.groups);

  const models = configuredModels.map((item) => ({
    value: item.ref,
    label: item.label,
    description: item.description,
    group: item.group,
    badge: item.missingSecret ? labels.missingProviderKey : item.isDefault ? labels.defaultModel : undefined,
    badgeTone: item.missingSecret ? "warning" as const : "default" as const,
  }));

  const rail = (
    <Rail
      page={page}
      settingsOpen={props.settingsOpen}
      attention={props.attention}
      worktrees={props.worktrees}
      plugins={props.plugins}
      labels={labels}
      onNavigate={(next) => {
        closeDrawer();
        props.onNavigate(next);
      }}
      onOpenSettings={() => {
        closeDrawer();
        props.onOpenSettings();
      }}
      onOpenImport={(sourceId) => {
        closeDrawer();
        props.onOpenImport(sourceId);
      }}
    />
  );

  const sidebar = (
    <Sidebar
      label={page === "threads" ? labels.threadsPage : page === "scm" ? labels.sourceControl : page === "agents" ? labels.agentsPage : page === "plugins" ? labels.pluginsPage : labels.contextPage}
      workspace={props.workspace}
      recentProjects={props.recentProjects}
      missingProjects={props.missingProjects}
      onRemoveRecentProject={props.onRemoveRecentProject}
      labels={labels}
      onPickWorkspace={props.onPickWorkspace}
      onOpenWorkspace={props.onOpenWorkspace}
    >
      {page === "threads" ? (
        <ThreadsSidebar
          groups={props.groups}
          selectedSessionId={route.kind === "thread" || route.kind === "review" ? props.selectedSessionId : ""}
          composing={route.kind === "new-task"}
          locale={props.locale}
          labels={labels}
          onNewTask={() => {
            closeDrawer();
            props.onNewTask();
          }}
          onSelectSession={(sessionId) => {
            closeDrawer();
            props.onSetRoute({ kind: "thread", sessionId });
          }}
          onRenameSession={props.onRenameSession}
          onPinSession={props.onPinSession}
          onArchiveSession={props.onArchiveSession}
          onDeleteSession={props.onDeleteSession}
        />
      ) : props.pageSidebar}
    </Sidebar>
  );

  const inspector = inspectorAvailable ? (
    <WorkspaceInspector
      tab={props.inspectorTab}
      events={props.events}
      modelRef={props.modelRef}
      models={models}
      modelPlaceholder={pickerPlaceholder(props.modelRef, configuredModels, labels)}
      policy={props.policy}
      agentCeiling={props.agentCeiling}
      maxSteps={props.maxSteps}
      health={props.health}
      pressure={props.pressure}
      command={props.command}
      lspCommand={props.lspCommand}
      lspArgs={props.lspArgs}
      lspLanguage={props.lspLanguage}
      lspStatus={props.lspStatus}
      lspDiagnosticPath={props.lspDiagnosticPath}
      lspDiagnostics={props.lspDiagnostics}
      subagents={props.subagents}
      checkpoints={props.checkpoints}
      workspaceOpen={Boolean(props.workspace)}
      selectedSessionId={props.selectedSessionId}
      running={props.running}
      busy={props.busy}
      configKey={props.configKey}
      trusting={props.trusting}
      labels={labels}
      onTabChange={props.onInspectorTabChange}
      onClose={() => props.onInspectorOpenChange(false)}
      onModelChange={props.onModelChange}
      onOpenProviders={props.onOpenProviders}
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
      onTrustWorkspace={props.onTrustWorkspace}
    />
  ) : undefined;

  return (
    <AppShell
      overlays={props.overlays}
      announcement={announcement}
      labels={labels}
      layout={props.layout}
      onLayoutChange={props.onLayoutChange}
      rail={rail}
      sidebar={sidebar}
      inspector={inspector}
      inspectorOpen={props.inspectorOpen}
      onInspectorOpenChange={props.onInspectorOpenChange}
      sidebarDrawerOpen={props.sidebarDrawerOpen}
      onSidebarDrawerOpenChange={props.onSidebarDrawerOpenChange}
      onNewThread={page === "threads" ? props.onNewTask : undefined}
      toolbar={(size) => (
        <WorkspaceTopbar
          route={route}
          size={size}
          current={current}
          parent={props.parent}
          runtime={props.runtime}
          running={props.running}
          busy={props.busy}
          inspectorAvailable={inspectorAvailable}
          inspectorOpen={props.inspectorOpen}
          labels={labels}
          onSetRoute={props.onSetRoute}
          onCleanupWorktree={props.onCleanupWorktree}
          onCancelAgent={props.onCancelAgent}
          onStartAgent={props.onStartAgent}
          onOpenPalette={props.onOpenPalette}
          onToggleInspector={() => props.onInspectorOpenChange(!props.inspectorOpen)}
        />
      )}
    >
      {props.children}
    </AppShell>
  );
}
