import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { AppShell } from "./components/app-shell/AppShell";
import { WorkspaceTopbar } from "./components/app-shell/WorkspaceTopbar";
import type { InspectorTab } from "./components/inspector/Inspector";
import { WorkspaceInspector } from "./components/inspector/WorkspaceInspector";
import { Button } from "./components/primitives/Button";
import { Dialog } from "./components/primitives/Dialog";
import { WorkspaceSidebar } from "./components/sidebar/WorkspaceSidebar";
import { WorkspaceRouteContent } from "./app/WorkspaceRouteContent";
import { useAgentActions } from "./app/hooks/useAgentActions";
import { useContextAttachments } from "./app/hooks/useContextAttachments";
import { useLSPController } from "./app/hooks/useLSPController";
import { useRuntimeEvents } from "./app/hooks/useRuntimeEvents";
import { useSessionMaintenanceActions } from "./app/hooks/useSessionMaintenanceActions";
import { useSessionRuntimeState } from "./app/hooks/useSessionRuntimeState";
import { useWorkspaceController } from "./app/hooks/useWorkspaceController";
import { buildSidebarGroups, providerModelOptions, sessionStatusLabel } from "./app/presentation-model";
import { routeSessionId, type WorkspaceRoute } from "./app/workspace-route";
import { copy, initialLocale, type Locale } from "./lib/i18n/app-copy";
import { bridge } from "./lib/bridge";
import { sessionRuntime } from "./lib/session-runtime";
import type { AgentConfig, RuntimeKind } from "./types";

type Policy = "read-only" | "workspace" | "full";


export default function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = copy[locale];
  const [route, setRoute] = useState<WorkspaceRoute>({ kind: "new-task" });
  const selected = routeSessionId(route);
  const [goal, setGoal] = useState("");
  const [policy, setPolicy] = useState<Policy>("workspace");
  const [runtimeKind, setRuntimeKind] = useState<RuntimeKind>("local");
  const [maxSteps, setMaxSteps] = useState(24);
  const [command, setCommand] = useState("git status --short");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const {
    state,
    setState,
    recentProjects,
    catalog,
    setCatalog,
    modelRef,
    setModelRef,
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("activity");
  const [cleanupWorktreeOpen, setCleanupWorktreeOpen] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    localStorage.setItem("lcx-locale", locale);
  }, [locale]);

  const current = useMemo(() => state.sessions.find((session) => session.id === selected), [state.sessions, selected]);
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

  const configuredModels = useMemo(() => providerModelOptions(catalog), [catalog]);

  const sessionGroups = useMemo(() => buildSidebarGroups({
    sessions: state.sessions,
    activeRunIds,
    workspace: state.workspace,
    labels: {
      active: t.active,
      created: t.created,
      completed: t.completed,
      interrupted: t.interrupted,
      waiting: t.waiting,
      running: t.running,
      unknown: t.unknown,
      runningThreads: t.runningThreads,
      attentionThreads: t.attentionThreads,
      pinnedThreads: t.pinnedThreads,
      recentThreads: t.recentThreads,
      archivedThreads: t.archivedThreads,
    },
  }), [activeRunIds, state.sessions, state.workspace, t]);

  function agentConfig(): AgentConfig {
    return {
      provider: {},
      modelRef: modelRef || undefined,
      policy,
      maxSteps,
      recentMessages: 12,
      maxToolCallsPerStep: 8
    };
  }


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
    getAgentConfig: agentConfig,
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
    cleanupCurrentWorktree,
    updateSessionUI,
  } = useSessionMaintenanceActions({
    selectedSessionId: selected,
    currentSession: current,
    currentRuntimeKind: currentRuntime.kind,
    running,
    busy,
    command,
    setWorkspaceState: setState,
    setRoute,
    setBusy,
    setError,
    setCleanupWorktreeOpen,
    refreshCurrent,
    resetSessionRuntime,
  });

  function afterWorkspaceChanged() {
    setRoute({ kind: "new-task" });
    resetSessionRuntime();
    clearContextPaths();
    setRuntimeKind("local");
    clearEvents();
    setInspectorOpen(false);
    setSidebarOpen(false);
  }

  async function pickWorkspace() {
    if (await pickWorkspaceState()) {
      afterWorkspaceChanged();
    }
  }

  async function openWorkspace(path: string) {
    if (await openWorkspaceState(path)) {
      afterWorkspaceChanged();
    }
  }

  function newTask() {
    setRoute({ kind: "new-task" });
    resetSessionRuntime();
    setGoal("");
    clearContextPaths();
    setRuntimeKind("local");
    setInspectorOpen(false);
    setSidebarOpen(false);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  function switchLocale() {
    setLocale((currentLocale) => currentLocale === "zh-CN" ? "en" : "zh-CN");
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const modelSelectOptions = configuredModels.map((item) => ({
    value: item.ref,
    label: item.label,
    description: item.description,
    group: item.group
  }));

  const runtimeState = health ? "online" : state.workspace ? "offline" : "ready";

  const sidebar = (
    <WorkspaceSidebar
      open={sidebarOpen}
      workspace={state.workspace}
      groups={sessionGroups}
      recentProjects={recentProjects}
      selectedSessionId={route.kind === "thread" || route.kind === "review" || route.kind === "extensions" ? selected : ""}
      providerActive={route.kind === "providers"}
      extensionsActive={route.kind === "extensions"}
      runtimeState={runtimeState}
      runtimeVersion={health?.version}
      labels={t}
      onClose={() => setSidebarOpen(false)}
      onNewTask={newTask}
      onPickWorkspace={pickWorkspace}
      onOpenWorkspace={openWorkspace}
      onSelectSession={(sessionId) => {
        setRoute({ kind: "thread", sessionId });
        setSidebarOpen(false);
      }}
      onRenameSession={(sessionId, title) => void updateSessionUI(sessionId, { title })}
      onPinSession={(sessionId, pinned) => void updateSessionUI(sessionId, { pinned })}
      onArchiveSession={(sessionId, archived) => void updateSessionUI(sessionId, { archived })}
      onOpenProviders={() => {
        setRoute({ kind: "providers" });
        setInspectorOpen(false);
        setSidebarOpen(false);
      }}
      onOpenExtensions={() => {
        setRoute({ kind: "extensions", sessionId: selected || undefined });
        setInspectorOpen(false);
        setSidebarOpen(false);
      }}
      onSwitchLocale={switchLocale}
    />
  );

  const inspector = route.kind === "thread" || route.kind === "new-task" ? (
    <WorkspaceInspector
      tab={inspectorTab}
      events={selectedEvents}
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
      workspaceOpen={Boolean(state.workspace)}
      selectedSessionId={selected}
      running={running}
      busy={busy}
      labels={t}
      onTabChange={setInspectorTab}
      onClose={() => setInspectorOpen(false)}
      onModelChange={setModelRef}
      onOpenProviders={() => {
        setRoute({ kind: "providers" });
        setInspectorOpen(false);
      }}
      onPolicyChange={setPolicy}
      onMaxStepsChange={setMaxSteps}
      onCommandChange={setCommand}
      onLSPCommandChange={setLSPCommand}
      onLSPDiagnosticPathChange={setLSPDiagnosticPath}
      onRefreshLSPDiagnostics={() => void refreshLSPDiagnostics()}
      onLSPArgsChange={setLSPArgs}
      onLSPLanguageChange={setLSPLanguage}
      onStartLSP={() => void startLSP()}
      onStopLSP={() => void stopLSP()}
      onOpenSubagent={(sessionId) => {
        setRoute({ kind: "thread", sessionId });
        setInspectorOpen(true);
        setInspectorTab("run");
      }}
      onRunShell={runShell}
    />
  ) : undefined;

  return (
    <>
      <AppShell
        sidebar={sidebar}
        sidebarOpen={sidebarOpen}
        inspectorOpen={inspectorOpen && (route.kind === "thread" || route.kind === "new-task")}
        inspector={inspector}
        closeLabel={t.close}
        onCloseSidebar={() => setSidebarOpen(false)}
      >
        <WorkspaceTopbar
          route={route}
          current={current}
          workspace={state.workspace}
          runtime={currentRuntime}
          running={running}
          busy={busy}
          inspectorOpen={inspectorOpen}
          labels={t}
          onOpenSidebar={() => setSidebarOpen(true)}
          onBackToWorkspace={() => {
            setRoute(route.kind === "extensions" && current
              ? { kind: "thread", sessionId: current.id }
              : { kind: "new-task" });
          }}
          onOpenReview={() => {
            if (!current) return;
            setRoute({ kind: "review", sessionId: current.id });
            setInspectorOpen(false);
          }}
          onOpenThread={() => {
            if (current) setRoute({ kind: "thread", sessionId: current.id });
          }}
          onCleanupWorktree={() => setCleanupWorktreeOpen(true)}
          onCancelAgent={() => void cancelAgent()}
          onStartAgent={() => void startAgent()}
          onToggleInspector={() => setInspectorOpen((open) => !open)}
        />

        <WorkspaceRouteContent
          route={route}
          current={current}
          runtime={currentRuntime}
          locale={locale}
          labels={t}
          workspace={state.workspace}
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
          textareaRef={composerRef}
          onCatalogChange={setCatalog}
          onModelChange={setModelRef}
          onError={setError}
          onGoalChange={setGoal}
          onPickContextFiles={pickContextFiles}
          onPickContextFolder={pickContextDirectory}
          onRemoveContextPath={removeContextPath}
          onPolicyChange={setPolicy}
          onRuntimeChange={setRuntimeKind}
          onPickWorkspace={pickWorkspace}
          onOpenWorkspace={openWorkspace}
          onOpenProviders={() => {
            setRoute({ kind: "providers" });
            setInspectorOpen(false);
          }}
          onApproveGate={approveGate}
          onLoadOlderMessages={loadOlderMessages}
          onJumpToLatest={jumpToLatestMessages}
          onCancel={cancelAgent}
          onRetry={() => void retryCurrent()}
          onSubmit={submitTask}
          onKeyDown={onComposerKeyDown}
          onSendReviewInstruction={sendReviewInstruction}
        />
      </AppShell>

      <Dialog
        open={cleanupWorktreeOpen}
        title={t.cleanupWorktreeTitle}
        description={t.cleanupWorktreeBody}
        onOpenChange={setCleanupWorktreeOpen}
        footer={
          <>
            <Button onClick={() => setCleanupWorktreeOpen(false)}>{t.cancel}</Button>
            <Button disabled={busy} onClick={() => void cleanupCurrentWorktree(false)}>
              {t.cleanupWorktree}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void cleanupCurrentWorktree(true)}>
              {t.forceCleanupWorktree}
            </Button>
          </>
        }
      />

      {error && (
        <div className="error-toast" role="alert">
          <strong>{t.error}</strong>
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label={t.close}><X size={14} strokeWidth={1.7} aria-hidden /></button>
        </div>
      )}
    </>
  );
}
