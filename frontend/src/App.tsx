import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Code2,
  FileDiff,
  Menu,
  PanelRight,
  Square,
  Trash2,
  X
} from "lucide-react";
import { AppShell } from "./components/app-shell/AppShell";
import { NewTaskComposer } from "./components/composer/NewTaskComposer";
import { ExtensionsWorkspace } from "./components/extensions/ExtensionsWorkspace";
import { Inspector, type InspectorTab } from "./components/inspector/Inspector";
import { ProviderSettingsPanel } from "./components/provider/ProviderSettingsPanel";
import { Button } from "./components/primitives/Button";
import { Dialog } from "./components/primitives/Dialog";
import { ReviewWorkspace } from "./components/review/ReviewWorkspace";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ThreadWorkspace } from "./components/thread/ThreadWorkspace";
import { useAgentActions } from "./app/hooks/useAgentActions";
import { useContextAttachments } from "./app/hooks/useContextAttachments";
import { useLSPController } from "./app/hooks/useLSPController";
import { useRuntimeEvents } from "./app/hooks/useRuntimeEvents";
import { useSessionMaintenanceActions } from "./app/hooks/useSessionMaintenanceActions";
import { useSessionRuntimeState } from "./app/hooks/useSessionRuntimeState";
import { useWorkspaceController } from "./app/hooks/useWorkspaceController";
import { buildSidebarGroups, providerModelOptions } from "./app/presentation-model";
import { routeSessionId, type WorkspaceRoute } from "./app/workspace-route";
import { copy, initialLocale, type Locale } from "./lib/i18n/app-copy";
import { bridge } from "./lib/bridge";
import { sessionRuntime } from "./lib/session-runtime";
import type { AgentConfig, RuntimeKind } from "./types";

type Policy = "read-only" | "workspace" | "full";

type IconName = "menu" | "panel" | "play" | "stop" | "close";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const props = { size, strokeWidth: 1.7, "aria-hidden": true as const };
  switch (name) {
    case "menu": return <Menu {...props} />;
    case "panel": return <PanelRight {...props} />;
    case "play": return <ArrowUp {...props} />;
    case "stop": return <Square {...props} />;
    case "close": return <X {...props} />;
  }
}

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

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
    <Sidebar
      open={sidebarOpen}
      workspace={state.workspace}
      workspaceName={state.workspace ? basename(state.workspace) : ""}
      groups={sessionGroups}
      recentProjects={recentProjects}
      selectedSessionId={route.kind === "thread" || route.kind === "review" || route.kind === "extensions" ? selected : ""}
      providerActive={route.kind === "providers"}
      extensionsActive={route.kind === "extensions"}
      runtimeState={runtimeState}
      runtimeVersion={health?.version}
      labels={{
        close: t.close,
        newTask: t.newTask,
        project: t.project,
        openProject: t.openProject,
        sessions: t.sessions,
        noSessions: t.noSessions,
        threadSearch: t.threadSearch,
        recentProjects: t.recentProjects,
        providerSettings: t.providerSettings,
        extensions: t.extensions,
        language: t.language,
        runtimeReady: t.runtimeReady,
        runtimeOnline: t.runtimeOnline,
        runtimeOffline: t.runtimeOffline,
        renameThread: t.renameThread,
        pinThread: t.pinThread,
        unpinThread: t.unpinThread,
        archiveThread: t.archiveThread,
        restoreThread: t.restoreThread,
        save: t.save,
        cancel: t.cancel,
        threadMenu: t.threadMenu,
        localRuntime: t.localRuntime,
        worktreeRuntime: t.worktreeRuntime
      }}
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
    <Inspector
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
      labels={{
        activity: t.activity,
        run: t.run,
        terminal: t.terminal,
        close: t.close,
        noActivity: t.noActivity,
        provider: t.provider,
        modelSelect: t.modelSelect,
        noModels: t.noModels,
        providerConfig: t.providerConfig,
        envFallback: t.envFallback,
        policy: t.policy,
        readOnly: t.readOnly,
        workspace: t.workspace,
        full: t.full,
        maxSteps: t.maxSteps,
        runtime: t.runtime,
        workingMemory: t.workingMemory,
        softBudget: t.softBudget,
        hardBudget: t.hardBudget,
        maxAgents: t.maxAgents,
        shellCommand: t.shellCommand,
        runCommand: t.runCommand,
        shellHint: t.shellHint,
        lsp: t.lsp,
        lspCommand: t.lspCommand,
        lspArgs: t.lspArgs,
        lspLanguage: t.lspLanguage,
        lspStart: t.lspStart,
        lspStop: t.lspStop,
        lspRunning: t.lspRunning,
        lspStopped: t.lspStopped,
        lspPid: t.lspPid,
        lspPending: t.lspPending,
        lspDiagnostics: t.lspDiagnostics,
        lspDiagnosticPath: t.lspDiagnosticPath,
        lspDiagnosticRefresh: t.lspDiagnosticRefresh,
        lspNoDiagnostics: t.lspNoDiagnostics,
        lspSeverityError: t.lspSeverityError,
        lspSeverityWarning: t.lspSeverityWarning,
        lspSeverityInfo: t.lspSeverityInfo,
        lspSeverityHint: t.lspSeverityHint,
        lspLastError: t.lspLastError,
        milestoneAgentStarted: t.milestoneAgentStarted,
        milestoneAgentStopped: t.milestoneAgentStopped,
        milestoneToolCompleted: t.milestoneToolCompleted,
        milestoneApprovalRequired: t.milestoneApprovalRequired,
        milestoneApprovalGranted: t.milestoneApprovalGranted,
        milestoneSubagentStarted: t.milestoneSubagentStarted,
        milestoneSubagentStopped: t.milestoneSubagentStopped,
        milestoneWorktreeCreated: t.milestoneWorktreeCreated,
        milestoneWorktreeApplied: t.milestoneWorktreeApplied,
        milestoneTaskCompleted: t.milestoneTaskCompleted,
        milestoneTaskInterrupted: t.milestoneTaskInterrupted,
        milestoneWorkflowAdvanced: t.milestoneWorkflowAdvanced,
        subagents: t.subagents,
        noSubagents: t.noSubagents,
        subagentActive: t.subagentActive,
        subagentCompleted: t.subagentCompleted,
        subagentInterrupted: t.subagentInterrupted,
        subagentCheckpoint: t.subagentCheckpoint
      }}
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
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label={t.expandSidebar}>
              <Icon name="menu" />
            </button>
            <div className="title-stack">
              <strong>{route.kind === "providers" ? t.providerSettings : route.kind === "extensions" ? t.extensions : route.kind === "review" ? t.review : current?.goal || (state.workspace ? basename(state.workspace) : "LumenCortex")}</strong>
              <span>
                {route.kind === "providers"
                  ? (state.workspace ? `${t.project} · ${basename(state.workspace)}` : t.providerConfig)
                  : route.kind === "extensions"
                    ? (state.workspace ? `${t.project} · ${basename(state.workspace)} · ${currentRuntime.kind === "worktree" ? (currentRuntime.branch || t.worktreeRuntime) : t.localRuntime}` : t.extensions)
                    : route.kind === "review"
                      ? (current?.goal || t.review)
                      : state.workspace
                    ? `${currentRuntime.kind === "worktree" ? (currentRuntime.branch || t.worktreeRuntime) : t.localRuntime}${current?.model ? ` · ${current.model}` : ""}${current ? ` · ${statusLabel(current.status, running)}` : ""}`
                    : t.runtimeReady}
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            {route.kind === "providers" && (
              <button className="toolbar-button" onClick={() => setRoute({ kind: "new-task" })}>
                <Code2 size={14} strokeWidth={1.7} aria-hidden />
                <span>{t.backToWorkspace}</span>
              </button>
            )}
            {route.kind === "extensions" && (
              <button
                className="toolbar-button"
                onClick={() => setRoute(current ? { kind: "thread", sessionId: current.id } : { kind: "new-task" })}
              >
                <Code2 size={14} strokeWidth={1.7} aria-hidden />
                <span>{t.backToWorkspace}</span>
              </button>
            )}
            {route.kind === "thread" && current && (
              <button className="toolbar-button" onClick={() => {
                setRoute({ kind: "review", sessionId: current.id });
                setInspectorOpen(false);
              }}>
                <FileDiff size={14} strokeWidth={1.7} aria-hidden />
                <span>{t.review}</span>
              </button>
            )}
            {route.kind === "review" && current && (
              <button className="toolbar-button" onClick={() => setRoute({ kind: "thread", sessionId: current.id })}>
                <Code2 size={14} strokeWidth={1.7} aria-hidden />
                <span>{t.thread}</span>
              </button>
            )}
            {(route.kind === "thread" || route.kind === "review") && current && currentRuntime.kind === "worktree" && !running && (
              <button className="toolbar-button" onClick={() => setCleanupWorktreeOpen(true)} disabled={busy}>
                <Trash2 size={14} strokeWidth={1.7} aria-hidden />
                <span>{t.cleanupWorktree}</span>
              </button>
            )}
            {route.kind === "thread" && current && running && (
              <button className="toolbar-button stop" onClick={cancelAgent} disabled={busy}>
                <Icon name="stop" size={14} />
                <span>{t.stop}</span>
              </button>
            )}
            {route.kind === "thread" && current && !running && (current.status === "created" || current.status === "interrupted") && (
              <button className="toolbar-button" onClick={() => startAgent()} disabled={busy}>
                <Icon name="play" size={14} />
                <span>{current.status === "interrupted" ? t.resume : t.start}</span>
              </button>
            )}
            {route.kind !== "providers" && route.kind !== "extensions" && (
              <button
                className={`icon-button ${inspectorOpen ? "active" : ""}`}
                onClick={() => setInspectorOpen((open) => !open)}
                aria-label={t.inspector}
              >
                <Icon name="panel" />
              </button>
            )}
          </div>
        </header>

        {route.kind === "providers" ? (
          <ProviderSettingsPanel
            locale={locale}
            workspace={state.workspace}
            effectiveCatalog={catalog}
            selectedModelRef={modelRef}
            onSelectedModelRef={setModelRef}
            onEffectiveCatalogChange={setCatalog}
            onError={setError}
          />
        ) : route.kind === "extensions" ? (
          <ExtensionsWorkspace
            workspace={state.workspace}
            sessionId={selected}
            runtime={currentRuntime}
            onError={setError}
            labels={{
              title: t.extensions,
              subtitle: t.extensionsSubtitle,
              mcpServers: t.mcpServers,
              addServer: t.mcpAddServer,
              noServers: t.mcpNoServers,
              serverId: t.mcpServerId,
              serverName: t.mcpServerName,
              command: t.mcpCommand,
              args: t.mcpArgs,
              protocol: t.mcpProtocol,
              legacy: t.mcpLegacy,
              modern: t.mcpModern,
              save: t.save,
              delete: t.delete,
              deleteTitle: t.mcpDeleteTitle,
              deleteBody: t.mcpDeleteBody,
              cancel: t.cancel,
              start: t.mcpStart,
              stop: t.mcpStop,
              refresh: t.handoffRefresh,
              running: t.lspRunning,
              stopped: t.lspStopped,
              pid: t.lspPid,
              pending: t.lspPending,
              tools: t.mcpTools,
              noTools: t.mcpNoTools,
              readOnly: t.readOnly,
              sideEffect: t.mcpSideEffect,
              noAutoStart: t.mcpNoAutoStart,
              currentRuntime: t.currentRuntime,
              localRuntime: t.localRuntime,
              worktreeRuntime: t.worktreeRuntime,
              lastError: t.lspLastError,
              selectServer: t.mcpSelectServer,
              enabled: t.enabled,
              disabled: t.disabled,
              globalScope: t.mcpGlobalScope,
              projectScope: t.mcpProjectScope,
              globalScopeHint: t.mcpGlobalScopeHint,
              projectScopeHint: t.mcpProjectScopeHint,
              inherited: t.mcpInherited,
              globalSource: t.mcpGlobalSource,
              projectSource: t.mcpProjectSource,
              mcpTab: t.mcpTab,
              skillsTab: t.skillsTab,
              permissionsTab: t.permissionsTab,
              permissions: t.permissions,
              permissionsDescription: t.permissionsDescription,
              permissionsBuiltIn: t.permissionsBuiltIn,
              permissionsLanguage: t.permissionsLanguage,
              permissionsSubagents: t.permissionsSubagents,
              permissionsMCP: t.permissionsMCP,
              permissionsOther: t.permissionsOther,
              permissionsEmpty: t.permissionsEmpty,
              skills: t.skills,
              skillAdd: t.skillAdd,
              skillEmpty: t.skillEmpty,
              skillGlobalHint: t.skillGlobalHint,
              skillProjectHint: t.skillProjectHint,
              skillId: t.skillId,
              skillContent: t.skillContent,
              skillDeleteTitle: t.skillDeleteTitle,
              skillDeleteBody: t.skillDeleteBody,
              skillError: t.skillError
            }}
          />
        ) : route.kind === "review" && current ? (
          <ReviewWorkspace
            sessionId={current.id}
            runtime={currentRuntime}
            messages={messages}
            agentBusy={busy}
            agentRunning={running}
            onSendInstruction={sendReviewInstruction}
            labels={{
              title: t.review,
              changedFiles: t.changedFiles,
              noChanges: t.noChanges,
              unified: t.unified,
              split: t.split,
              worktree: t.worktree,
              staged: t.staged,
              stage: t.stage,
              unstage: t.unstage,
              revert: t.revert,
              revertTitle: t.revertTitle,
              revertBody: t.revertBody,
              cancel: t.cancel,
              commit: t.commit,
              commitPlaceholder: t.commitPlaceholder,
              push: t.push,
              truncated: t.diffTruncated,
              loading: t.loading,
              binaryDiff: t.binaryDiff,
              reviewInstruction: t.reviewInstruction,
              reviewInstructionPlaceholder: t.reviewInstructionPlaceholder,
              sendToAgent: t.sendToAgent,
              agentRunning: t.agentRunning,
              checks: t.checks,
              checkPassed: t.checkPassed,
              checkFailed: t.checkFailed,
              checkTruncated: t.checkTruncated,
              localRuntime: t.localRuntime,
              worktreeRuntime: t.worktreeRuntime,
              conflictTitle: t.worktreeConflictTitle,
              conflictHint: t.worktreeConflictHint,
              handoffTitle: t.handoffTitle,
              handoffTarget: t.handoffTarget,
              handoffCommits: t.handoffCommits,
              handoffReady: t.handoffReady,
              handoffSourceDirty: t.handoffSourceDirty,
              handoffTargetDirty: t.handoffTargetDirty,
              handoffNoCommits: t.handoffNoCommits,
              handoffOverlap: t.handoffOverlap,
              handoffApply: t.handoffApply,
              handoffRefresh: t.handoffRefresh,
              handoffConfirmTitle: t.handoffConfirmTitle,
              handoffConfirmBody: t.handoffConfirmBody,
              handoffApplied: t.handoffApplied
            }}
          />
        ) : !current ? (
          <NewTaskComposer
            title={t.buildTitle}
            subtitle={t.newTaskSubtitle}
            placeholder={t.composerPlaceholder}
            workspace={state.workspace}
            workspaceName={state.workspace ? basename(state.workspace) : ""}
            recentProjects={recentProjects}
            recentProjectsLabel={t.recentProjects}
            chooseProjectLabel={t.openProject}
            modelLabel={t.modelSelect}
            modelRef={modelRef}
            models={configuredModels}
            noModelsLabel={t.modelFallback}
            contextPaths={contextPaths}
            contextLabels={{
              context: t.context,
              files: t.attachFiles,
              folder: t.attachFolder,
              remove: t.removeContext
            }}
            policyLabel={t.policy}
            policy={policy}
            policyLabels={{
              "read-only": t.readOnly,
              workspace: t.workspace,
              full: t.full
            }}
            environmentLabel={t.environment}
            runtime={runtimeKind}
            runtimeLabels={{
              local: t.localRuntime,
              worktree: t.worktreeRuntime
            }}
            runtimeDescriptions={{
              local: t.localRuntimeDescription,
              worktree: t.worktreeRuntimeDescription
            }}
            hint={t.composerHint}
            startLabel={t.start}
            goal={goal}
            busy={busy}
            textareaRef={composerRef}
            onGoalChange={setGoal}
            onModelChange={setModelRef}
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
            onSubmit={submitTask}
            onKeyDown={onComposerKeyDown}
          />
        ) : (
          <ThreadWorkspace
            session={current}
            runtime={currentRuntime}
            messages={messages}
            hasOlderMessages={messages.length > 0 && messages[0].seq > 0}
            historicalMessages={!messageAtLatest}
            loadingOlderMessages={messageLoadingOlder}
            running={running}
            statusLabel={statusLabel(current.status, running)}
            workspaceName={basename(state.workspace)}
            modelRef={modelRef}
            models={modelSelectOptions}
            policyLabel={policy === "read-only" ? t.readOnly : policy === "full" ? t.full : t.workspace}
            goal={goal}
            busy={busy}
            workflowSummary={workflowSummary}
            activeSubagents={subagents.filter((node) => node.active).length}
            textareaRef={composerRef}
            labels={{
              newTask: t.newTask,
              running: t.running,
              noMessages: t.noMessages,
              finalAnswer: t.finalAnswer,
              startAnother: t.startAnother,
              composerPlaceholder: t.composerPlaceholder,
              composerHint: t.composerHint,
              noModels: t.noModels,
              start: t.start,
              roleUser: t.messageRoleUser,
              roleAssistant: t.messageRoleAssistant,
              roleTool: t.messageRoleTool,
              roleSystem: t.messageRoleSystem,
              approvalTitle: t.approvalTitle,
              approve: t.approve,
              loadEarlier: t.loadEarlier,
              backToLatest: t.backToLatest,
              historyWindow: t.historyWindow,
              localRuntime: t.localRuntime,
              worktreeRuntime: t.worktreeRuntime,
              plan: t.plan,
              planRunning: t.planRunning,
              planWaiting: t.planWaiting,
              planSubagents: t.planSubagents,
              copy: t.copy,
              copied: t.copied,
              retry: t.retry
            }}
            onGoalChange={setGoal}
            onModelChange={setModelRef}
            onApproveGate={approveGate}
            onLoadOlderMessages={loadOlderMessages}
            onJumpToLatest={jumpToLatestMessages}
            onCancel={cancelAgent}
            onRetry={() => void retryCurrent()}
            onSubmit={submitTask}
            onKeyDown={onComposerKeyDown}
          />
        )}
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
          <button onClick={() => setError("")} aria-label={t.close}><Icon name="close" size={14} /></button>
        </div>
      )}
    </>
  );
}
