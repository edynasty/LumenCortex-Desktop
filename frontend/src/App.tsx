import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Code2,
  FileDiff,
  Menu,
  PanelRight,
  Square,
  X
} from "lucide-react";
import { AppShell } from "./components/app-shell/AppShell";
import { NewTaskComposer } from "./components/composer/NewTaskComposer";
import { Inspector, type InspectorTab } from "./components/inspector/Inspector";
import { ProviderSettingsPanel } from "./components/provider/ProviderSettingsPanel";
import { ReviewWorkspace } from "./components/review/ReviewWorkspace";
import { Sidebar, type SidebarGroup } from "./components/sidebar/Sidebar";
import { ThreadWorkspace } from "./components/thread/ThreadWorkspace";
import { routeSessionId, type WorkspaceRoute } from "./app/workspace-route";
import { copy, initialLocale, type Locale } from "./lib/i18n/app-copy";
import { bridge, onRuntimeEvent } from "./lib/bridge";
import type { AgentConfig, Message, ProviderCatalog, RuntimeEvent, Session, WorkflowSummary, WorkspaceState } from "./types";

const MAX_VISIBLE_EVENTS = 180;
const MAX_VISIBLE_MESSAGES = 100;

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
  const [state, setState] = useState<WorkspaceState>({ workspace: "", sessions: [], activeRuns: [] });
  const [route, setRoute] = useState<WorkspaceRoute>({ kind: "new-task" });
  const [recentProjects, setRecentProjects] = useState<string[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem("lcx-recent-projects") || "[]");
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const selected = routeSessionId(route);
  const [goal, setGoal] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [workflowSummary, setWorkflowSummary] = useState<WorkflowSummary | null>(null);
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [catalog, setCatalog] = useState<ProviderCatalog>({ providers: {} });
  const [modelRef, setModelRef] = useState("");
  const [policy, setPolicy] = useState<Policy>("workspace");
  const [maxSteps, setMaxSteps] = useState(24);
  const [command, setCommand] = useState("git status --short");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("activity");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bridge.state().then((next) => {
      setState(next);
      setRoute({ kind: "new-task" });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem("lcx-locale", locale);
  }, [locale]);

  useEffect(() => {
    if (!state.workspace) return;
    setRecentProjects((current) => {
      const next = [state.workspace, ...current.filter((path) => path !== state.workspace)].slice(0, 8);
      localStorage.setItem("lcx-recent-projects", JSON.stringify(next));
      return next;
    });
  }, [state.workspace]);

  useEffect(() => {
    bridge.providerCatalog().then((next) => {
      setCatalog(next);
      setModelRef((current) => current || next.model || "");
    }).catch((err) => setError(String(err)));
  }, [state.workspace]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setWorkflowSummary(null);
      return;
    }
    Promise.all([
      bridge.recentMessages(selected, MAX_VISIBLE_MESSAGES),
      bridge.workflowSummary(selected),
    ]).then(([recent, summary]) => {
      setMessages(recent);
      setWorkflowSummary(summary);
    }).catch(() => undefined);
  }, [selected]);

  useEffect(() => onRuntimeEvent((event) => {
    setEvents((current) => [...current, event].slice(-MAX_VISIBLE_EVENTS));

    if (
      event.type === "run.started" ||
      event.type === "run.stopped" ||
      event.type === "session.complete" ||
      event.type === "session.interrupted" ||
      event.type === "workflow.gate_waiting" ||
      event.type === "workflow.approved"
    ) {
      bridge.state().then(setState).catch(() => undefined);
    }

    if (
      event.sessionId &&
      event.sessionId === selected &&
      (event.type === "session.complete" || event.type === "session.interrupted" || event.type === "tool.end" || event.type === "workflow.transition" || event.type === "workflow.gate_waiting" || event.type === "workflow.approved")
    ) {
      Promise.all([
        bridge.recentMessages(selected, MAX_VISIBLE_MESSAGES),
        bridge.workflowSummary(selected),
      ]).then(([recent, summary]) => {
        setMessages(recent);
        setWorkflowSummary(summary);
      }).catch(() => undefined);
    }
  }), [selected]);

  const current = useMemo(() => state.sessions.find((session) => session.id === selected), [state.sessions, selected]);
  const activeRunIds = useMemo(() => new Set(state.activeRuns.map((run) => run.sessionId)), [state.activeRuns]);
  const running = selected ? activeRunIds.has(selected) : false;
  const health = state.health;
  const pressure = health && health.budget.softBytes > 0 ? Math.min(100, (health.usedBytes / health.budget.softBytes) * 100) : 0;
  const selectedEvents = useMemo(
    () => events.filter((event) => !selected || !event.sessionId || event.sessionId === selected),
    [events, selected]
  );

  const configuredModels = useMemo(() => {
    return Object.entries(catalog.providers || {}).flatMap(([providerID, provider]) =>
      Object.entries(provider.models || {}).map(([modelID, definition]) => {
        const metadata = [
          definition.modelID && definition.modelID !== modelID ? definition.modelID : "",
          definition.limit?.context ? Math.round(definition.limit.context / 1024) + "K ctx" : ""
        ].filter(Boolean).join(" · ");
        return {
          ref: providerID + "/" + modelID,
          label: definition.name || modelID,
          group: provider.name || providerID,
          description: metadata
        };
      })
    );
  }, [catalog]);

  const sessionGroups = useMemo<SidebarGroup[]>(() => {
    const runningSessions: Session[] = [];
    const attentionSessions: Session[] = [];
    const recentSessions: Session[] = [];

    for (const session of state.sessions) {
      if (activeRunIds.has(session.id)) {
        runningSessions.push(session);
      } else if (session.status === "waiting_gate" || session.error || session.status === "running") {
        attentionSessions.push(session);
      } else {
        recentSessions.push(session);
      }
    }

    return [
      { key: "running", label: t.runningThreads, raw: runningSessions },
      { key: "attention", label: t.attentionThreads, raw: attentionSessions },
      { key: "recent", label: t.recentThreads, raw: recentSessions }
    ]
      .filter((group) => group.raw.length > 0)
      .map((group) => ({
        key: group.key,
        label: group.label,
        sessions: group.raw.map((session) => {
          const active = activeRunIds.has(session.id);
          return {
            session,
            active,
            statusLabel: session.status === "running" && !active
              ? t.interrupted
              : statusLabel(session.status, active)
          };
        })
      }));
  }, [activeRunIds, state.sessions, t.attentionThreads, t.interrupted, t.recentThreads, t.runningThreads]);


  function statusLabel(status?: string, isRunning = false) {
    if (isRunning) return t.active;
    switch (status) {
      case "created": return t.created;
      case "completed": return t.completed;
      case "interrupted": return t.interrupted;
      case "waiting_gate": return t.waiting;
      case "running": return t.running;
      default: return status || t.unknown;
    }
  }

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

  async function refreshCurrent(sessionId = selected) {
    if (!sessionId) return;
    const [session, recent, summary] = await Promise.all([
      bridge.getSession(sessionId),
      bridge.recentMessages(sessionId, MAX_VISIBLE_MESSAGES),
      bridge.workflowSummary(sessionId),
    ]);
    if (sessionId === selected) {
      setMessages(recent);
      setWorkflowSummary(summary);
    }
    setState((currentState) => ({
      ...currentState,
      sessions: currentState.sessions.map((item) => item.id === session.id ? session : item)
    }));
  }

  async function pickWorkspace() {
    setError("");
    try {
      const next = await bridge.pickWorkspace();
      setState(next);
      setRoute({ kind: "new-task" });
      setMessages([]);
      setWorkflowSummary(null);
      setEvents([]);
      setSidebarOpen(false);
    } catch (err) {
      setError(String(err));
    }
  }

  async function openWorkspace(path: string) {
    setError("");
    try {
      const next = await bridge.openWorkspace(path);
      setState(next);
      setRoute({ kind: "new-task" });
      setMessages([]);
      setWorkflowSummary(null);
      setEvents([]);
      setSidebarOpen(false);
    } catch (err) {
      setError(String(err));
    }
  }

  async function startAgent(sessionId = selected) {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const session = await bridge.startAgent(sessionId, agentConfig());
      const nextState = await bridge.state();
      setState({
        ...nextState,
        sessions: nextState.sessions.map((item) => item.id === session.id ? session : item)
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task = goal.trim();
    if (!task || !state.workspace || busy) return;

    if (route.kind === "thread" && current) {
      if (running) return;
      setBusy(true);
      setError("");
      try {
        await bridge.continueAgent(current.id, task, agentConfig());
        setGoal("");
        const nextState = await bridge.state();
        setState(nextState);
        await refreshCurrent(current.id);
      } catch (err) {
        setError(String(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setError("");
    try {
      const session = await bridge.createSession(task);
      setState((currentState) => ({
        ...currentState,
        sessions: [session, ...currentState.sessions.filter((item) => item.id !== session.id)]
      }));
      setRoute({ kind: "thread", sessionId: session.id });
      setMessages([]);
      setWorkflowSummary(null);
      setGoal("");
      try {
        const started = await bridge.startAgent(session.id, agentConfig());
        const nextState = await bridge.state();
        setState({
          ...nextState,
          sessions: nextState.sessions.map((item) => item.id === started.id ? started : item)
        });
      } catch (err) {
        setError(String(err));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancelAgent() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await bridge.cancelAgent(selected);
      const nextState = await bridge.state();
      setState(nextState);
      await refreshCurrent(selected);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function approveGate(gateId: string) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const summary = await bridge.approveWorkflowGate(selected, gateId);
      setWorkflowSummary(summary);
      await refreshCurrent(selected);

      const stillWaiting = (summary.pendingGates || []).some((gate) => gate.type === "human");
      if (!stillWaiting) {
        await bridge.startAgent(selected, agentConfig());
      }
      const nextState = await bridge.state();
      setState(nextState);
      await refreshCurrent(selected);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runShell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !command.trim()) return;
    setBusy(true);
    setError("");
    try {
      await bridge.runShell(selected, command.trim());
      await refreshCurrent(selected);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  function newTask() {
    setRoute({ kind: "new-task" });
    setMessages([]);
    setWorkflowSummary(null);
    setGoal("");
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
      selectedSessionId={route.kind === "thread" || route.kind === "review" ? selected : ""}
      providerActive={route.kind === "providers"}
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
        language: t.language,
        runtimeReady: t.runtimeReady,
        runtimeOnline: t.runtimeOnline,
        runtimeOffline: t.runtimeOffline
      }}
      onClose={() => setSidebarOpen(false)}
      onNewTask={newTask}
      onPickWorkspace={pickWorkspace}
      onOpenWorkspace={openWorkspace}
      onSelectSession={(sessionId) => {
        setRoute({ kind: "thread", sessionId });
        setSidebarOpen(false);
      }}
      onOpenProviders={() => {
        setRoute({ kind: "providers" });
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
        shellHint: t.shellHint
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
              <strong>{route.kind === "providers" ? t.providerSettings : route.kind === "review" ? t.review : current?.goal || (state.workspace ? basename(state.workspace) : "LumenCortex")}</strong>
              <span>
                {route.kind === "providers"
                  ? (state.workspace ? `${t.project} · ${basename(state.workspace)}` : t.providerConfig)
                  : route.kind === "review"
                    ? (current?.goal || t.review)
                    : state.workspace
                    ? `${t.local}${current?.model ? ` · ${current.model}` : ""}${current ? ` · ${statusLabel(current.status, running)}` : ""}`
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
        ) : route.kind === "review" && current ? (
          <ReviewWorkspace
            workspace={state.workspace}
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
              loading: t.loading
            }}
          />
        ) : !current ? (
          <NewTaskComposer
            title={t.buildTitle}
            subtitle={t.newTaskSubtitle}
            placeholder={t.composerPlaceholder}
            workspace={state.workspace}
            workspaceName={state.workspace ? basename(state.workspace) : ""}
            chooseProjectLabel={t.openProject}
            modelLabel={t.modelSelect}
            modelRef={modelRef}
            models={configuredModels}
            noModelsLabel={t.modelFallback}
            policyLabel={t.policy}
            policy={policy}
            policyLabels={{
              "read-only": t.readOnly,
              workspace: t.workspace,
              full: t.full
            }}
            localLabel={t.local}
            hint={t.composerHint}
            startLabel={t.start}
            goal={goal}
            busy={busy}
            textareaRef={composerRef}
            onGoalChange={setGoal}
            onModelChange={setModelRef}
            onPolicyChange={setPolicy}
            onPickWorkspace={pickWorkspace}
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
            messages={messages}
            running={running}
            statusLabel={statusLabel(current.status, running)}
            workspaceName={basename(state.workspace)}
            modelRef={modelRef}
            models={modelSelectOptions}
            policyLabel={policy === "read-only" ? t.readOnly : policy === "full" ? t.full : t.workspace}
            goal={goal}
            busy={busy}
            workflowSummary={workflowSummary}
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
              approve: t.approve
            }}
            onGoalChange={setGoal}
            onModelChange={setModelRef}
            onApproveGate={approveGate}
            onCancel={cancelAgent}
            onSubmit={submitTask}
            onKeyDown={onComposerKeyDown}
          />
        )}
      </AppShell>

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
