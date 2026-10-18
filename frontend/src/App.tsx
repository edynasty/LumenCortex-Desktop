import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { InspectorTab } from "./components/inspector/inspector-types";
import { WorkspaceView } from "./app/WorkspaceView";
import type { SettingsState } from "./app/useWorkspaceCommands";
import { buildAgentConfig, type AgentPolicy } from "./app/agent-config";
import { useAgentActions } from "./app/hooks/useAgentActions";
import { useContextAttachments } from "./app/hooks/useContextAttachments";
import { useLSPController } from "./app/hooks/useLSPController";
import { useRuntimeEvents } from "./app/hooks/useRuntimeEvents";
import { useSessionMaintenanceActions } from "./app/hooks/useSessionMaintenanceActions";
import { useSessionRuntimeState } from "./app/hooks/useSessionRuntimeState";
import { useWorkspaceController } from "./app/hooks/useWorkspaceController";
import { useModelSelection } from "./app/hooks/useModelSelection";
import { modelOptions } from "./app/model-selection";
import { buildSidebarGroups } from "./app/presentation-model";
import { routeSessionId, type WorkspaceRoute } from "./app/workspace-route";
import { copy, initialLocale, type Locale } from "./lib/i18n/app-copy";
import { sessionRuntime } from "./lib/session-runtime";
import { sessionUI } from "./lib/session-ui";
import { useThemePreference } from "./lib/theme";
import { useLayoutPreference } from "./lib/layout-preference";
import type { RuntimeKind } from "./types";
import type { WorktreeCleanupTarget } from "./components/worktree/WorktreeCleanupDialog";

export default function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [themePreference, setThemePreference] = useThemePreference();
  const [layout, setLayout] = useLayoutPreference();
  const t = copy[locale];
  const [route, setRoute] = useState<WorkspaceRoute>({ kind: "new-task" });
  const selected = routeSessionId(route);
  const [goal, setGoal] = useState("");
  const [policy, setPolicy] = useState<AgentPolicy>("workspace");
  const [runtimeKind, setRuntimeKind] = useState<RuntimeKind>("local");
  const [maxSteps, setMaxSteps] = useState(24);
  const [command, setCommand] = useState("git status --short");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const {
    state,
    setState,
    recentProjects,
    config,
    refreshConfig,
    trustWorkspace,
    trusting,
    opening,
    pickWorkspace: pickWorkspaceState,
    openWorkspace: openWorkspaceState,
  } = useWorkspaceController({ setError });

  const {
    paths: contextPaths,
    pickFiles: pickContextFiles,
    pickDirectory: pickContextDirectory,
    remove: removeContextPath,
    clear: clearContextPaths,
  } = useContextAttachments({
    workspace: state.workspace,
    setError,
  });

  const {
    messages,
    atLatest: messageAtLatest,
    loadingOlder: messageLoadingOlder,
    workflowSummary,
    subagents,
    checkpoints,
    refreshCurrent,
    loadOlder: loadOlderMessages,
    jumpToLatest: jumpToLatestMessages,
    handleRuntimeEvent: handleSessionRuntimeEvent,
    reset: resetSessionRuntime,
    replaceWorkflowSummary,
  } = useSessionRuntimeState({
    selectedSessionId: selected,
    setWorkspaceState: setState,
    setError,
  });

  const {
    command: lspCommand,
    setCommand: setLSPCommand,
    args: lspArgs,
    setArgs: setLSPArgs,
    language: lspLanguage,
    setLanguage: setLSPLanguage,
    status: lspStatus,
    diagnosticPath: lspDiagnosticPath,
    setDiagnosticPath: setLSPDiagnosticPath,
    diagnostics: lspDiagnostics,
    refreshStatus: refreshLSPStatus,
    start: startLSP,
    stop: stopLSP,
    refreshDiagnostics: refreshLSPDiagnostics,
  } = useLSPController({
    workspace: state.workspace,
    selectedSessionId: selected,
    busy,
    setBusy,
    setError,
  });

  const { events, clearEvents } = useRuntimeEvents({
    selectedSessionId: selected,
    setWorkspaceState: setState,
    refreshLSPStatus,
    handleSessionRuntimeEvent,
  });

  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({ open: false, pane: "general", mounted: false });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("activity");
  const [worktreeCleanupTarget, setWorktreeCleanupTarget] = useState<WorktreeCleanupTarget | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    localStorage.setItem("lcx-locale", locale);
  }, [locale]);

  const current = useMemo(() => state.sessions.find((session) => session.id === selected), [state.sessions, selected]);
  const parent = useMemo(() => {
    const parentId = current ? sessionUI(current).parentSessionId : undefined;
    return parentId ? state.sessions.find((session) => session.id === parentId) : undefined;
  }, [current, state.sessions]);
  const activeRunIds = useMemo(() => new Set(state.activeRuns.map((run) => run.sessionId)), [state.activeRuns]);
  const running = selected ? activeRunIds.has(selected) : false;
  const currentRuntime = useMemo(
    () => current ? sessionRuntime(current, state.workspace) : { kind: "local" as const, path: state.workspace },
    [current, state.workspace]
  );
  const health = state.health;
  const pressure = health && health.budget.softBytes > 0 ? Math.min(100, (health.usedBytes / health.budget.softBytes) * 100) : 0;
  const selectedEvents = useMemo(
    () => events.filter((event) => !selected || !event.sessionId || event.sessionId === selected),
    [events, selected]
  );
  const configuredModels = useMemo(() => modelOptions(config), [config]);
  const { modelRef, selectModel, resetModelChoice, agentModelRef } = useModelSelection({ config, session: current, sessionId: selected || "" });
  const sessionGroups = useMemo(() => buildSidebarGroups({
    sessions: state.sessions,
    activeRunIds,
    workspace: state.workspace,
    // The app copy carries every status and group label the sidebar needs.
    labels: t,
  }), [activeRunIds, state.sessions, state.workspace, t]);

  const {
    startAgent,
    submitTask,
    cancelAgent,
    approveGate,
    retryCurrent,
    sendReviewInstruction,
  } = useAgentActions({
    selectedSessionId: selected,
    currentSession: current,
    route,
    running,
    busy,
    workspace: state.workspace,
    goal,
    contextPaths,
    runtimeKind,
    getAgentConfig: () => buildAgentConfig(agentModelRef(), policy, maxSteps, current ? sessionUI(current).delegation : "none"),
    setWorkspaceState: setState,
    setRoute,
    setGoal,
    clearContextPaths,
    setRuntimeKind,
    setBusy,
    setError,
    setInspectorOpen,
    refreshCurrent,
    resetSessionRuntime,
    replaceWorkflowSummary,
  });

  const {
    runShell,
    completeWorktreeCleanup,
    updateSessionUI,
  } = useSessionMaintenanceActions({
    selectedSessionId: selected,
    busy,
    command,
    setWorkspaceState: setState,
    setRoute,
    setBusy,
    setError,
    setWorktreeCleanupTarget,
    refreshCurrent,
    resetSessionRuntime,
  });

  function afterWorkspaceChanged() {
    resetModelChoice();
    setRoute({ kind: "new-task" });
    resetSessionRuntime();
    clearContextPaths();
    setRuntimeKind("local");
    clearEvents();
    setInspectorOpen(false);
    setSidebarDrawerOpen(false);
  }

  async function pickWorkspace() {
    if (await pickWorkspaceState()) afterWorkspaceChanged();
  }

  async function openWorkspace(path: string) {
    if (await openWorkspaceState(path)) afterWorkspaceChanged();
  }

  function newTask() {
    resetModelChoice();
    setRoute({ kind: "new-task" });
    resetSessionRuntime();
    setGoal("");
    clearContextPaths();
    setRuntimeKind("local");
    setInspectorOpen(false);
    setSidebarDrawerOpen(false);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <WorkspaceView
      route={route}
      current={current}
      parent={parent}
      runtime={currentRuntime}
      locale={locale}
      labels={t}
      themePreference={themePreference}
      workspace={state.workspace}
      sessions={state.sessions}
      groups={sessionGroups}
      recentProjects={recentProjects}
      selectedSessionId={selected}
      runtimeState={health ? "online" : state.workspace ? "offline" : "ready"}
      activeRuns={state.activeRuns.length}
      health={health}
      pressure={pressure}
      layout={layout}
      sidebarDrawerOpen={sidebarDrawerOpen}
      inspectorOpen={inspectorOpen}
      inspectorTab={inspectorTab}
      settings={settings}
      paletteOpen={paletteOpen}
      events={selectedEvents}
      config={config}
      trusting={trusting}
      modelRef={modelRef}
      configuredModels={configuredModels}
      contextPaths={contextPaths}
      policy={policy}
      runtimeKind={runtimeKind}
      maxSteps={maxSteps}
      command={command}
      lspCommand={lspCommand}
      lspArgs={lspArgs}
      lspLanguage={lspLanguage}
      lspStatus={lspStatus}
      lspDiagnosticPath={lspDiagnosticPath}
      lspDiagnostics={lspDiagnostics}
      messages={messages}
      messageAtLatest={messageAtLatest}
      messageLoadingOlder={messageLoadingOlder}
      running={running}
      busy={busy || opening}
      goal={goal}
      workflowSummary={workflowSummary}
      subagents={subagents}
      checkpoints={checkpoints}
      worktreeCleanupTarget={worktreeCleanupTarget}
      error={error}
      textareaRef={composerRef}
      onSetRoute={setRoute}
      onLayoutChange={setLayout}
      onSidebarDrawerOpenChange={setSidebarDrawerOpen}
      onSettingsChange={setSettings}
      onPaletteOpenChange={setPaletteOpen}
      onInspectorOpenChange={setInspectorOpen}
      onInspectorTabChange={setInspectorTab}
      onWorktreeCleanupTargetChange={setWorktreeCleanupTarget}
      onWorktreeCleanupCompleted={(deletedSessionIds) => void completeWorktreeCleanup(deletedSessionIds)}
      onNewTask={newTask}
      onPickWorkspace={pickWorkspace}
      onOpenWorkspace={openWorkspace}
      onRenameSession={(sessionId, title) => void updateSessionUI(sessionId, { title })}
      onPinSession={(sessionId, pinned) => void updateSessionUI(sessionId, { pinned })}
      onArchiveSession={(sessionId, archived) => void updateSessionUI(sessionId, { archived })}
      onLocaleChange={setLocale}
      onThemePreferenceChange={setThemePreference}
      onConfigChanged={() => void refreshConfig()}
      onTrustWorkspace={() => void trustWorkspace()}
      onModelChange={selectModel}
      onError={setError}
      onClearError={() => setError("")}
      onPolicyChange={setPolicy}
      onRuntimeChange={setRuntimeKind}
      onMaxStepsChange={setMaxSteps}
      onCommandChange={setCommand}
      onLSPCommandChange={setLSPCommand}
      onLSPArgsChange={setLSPArgs}
      onLSPLanguageChange={setLSPLanguage}
      onLSPDiagnosticPathChange={setLSPDiagnosticPath}
      onRefreshLSPDiagnostics={() => void refreshLSPDiagnostics()}
      onStartLSP={() => void startLSP()}
      onStopLSP={() => void stopLSP()}
      onOpenSubagent={(sessionId) => {
        setRoute({ kind: "thread", sessionId });
        setInspectorOpen(true);
        setInspectorTab("run");
      }}
      onRunShell={runShell}
      onGoalChange={setGoal}
      onPickContextFiles={pickContextFiles}
      onPickContextFolder={pickContextDirectory}
      onRemoveContextPath={removeContextPath}
      onApproveGate={approveGate}
      onLoadOlderMessages={loadOlderMessages}
      onJumpToLatest={jumpToLatestMessages}
      onCancelAgent={() => void cancelAgent()}
      onRetry={() => void retryCurrent()}
      onStartAgent={() => void startAgent()}
      onSubmit={submitTask}
      onKeyDown={onComposerKeyDown}
      onSendReviewInstruction={sendReviewInstruction}
      onRefreshThread={refreshCurrent}
      onDelegationChange={(sessionId, delegation) => void updateSessionUI(sessionId, { delegation })}
    />
  );

}
