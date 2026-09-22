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
import { Sidebar, type SidebarGroup } from "./components/sidebar/Sidebar";
import { ThreadWorkspace } from "./components/thread/ThreadWorkspace";
import { routeSessionId, type WorkspaceRoute } from "./app/workspace-route";
import { copy, initialLocale, type Locale } from "./lib/i18n/app-copy";
import { bridge, onRuntimeEvent } from "./lib/bridge";
import { splitCommandArgs } from "./lib/command-line";
import { sessionUI } from "./lib/session-ui";
import { sessionRuntime } from "./lib/session-runtime";
import type { AgentConfig, LSPDiagnostic, LSPStatus, Message, ProviderCatalog, RuntimeEvent, RuntimeKind, Session, SessionCheckpoint, SubagentNode, WorkflowSummary, WorkspaceState } from "./types";

const MAX_VISIBLE_EVENTS = 180;
const MESSAGE_PAGE_SIZE = 100;
const MAX_LOADED_MESSAGES = 500;

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

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const bySeq = new Map<number, Message>();
  for (const message of current) bySeq.set(message.seq, message);
  for (const message of incoming) bySeq.set(message.seq, message);
  return Array.from(bySeq.values()).sort((a, b) => a.seq - b.seq);
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
  const [contextPaths, setContextPaths] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageAtLatest, setMessageAtLatest] = useState(true);
  const [messageLoadingOlder, setMessageLoadingOlder] = useState(false);
  const [workflowSummary, setWorkflowSummary] = useState<WorkflowSummary | null>(null);
  const [subagents, setSubagents] = useState<SubagentNode[]>([]);
  const [checkpoints, setCheckpoints] = useState<SessionCheckpoint[]>([]);
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [catalog, setCatalog] = useState<ProviderCatalog>({ providers: {} });
  const [modelRef, setModelRef] = useState("");
  const [policy, setPolicy] = useState<Policy>("workspace");
  const [runtimeKind, setRuntimeKind] = useState<RuntimeKind>("local");
  const [maxSteps, setMaxSteps] = useState(24);
  const [command, setCommand] = useState("git status --short");
  const [lspCommand, setLSPCommand] = useState(() => localStorage.getItem("lcx-lsp-command") || "gopls");
  const [lspArgs, setLSPArgs] = useState(() => localStorage.getItem("lcx-lsp-args") || "");
  const [lspLanguage, setLSPLanguage] = useState(() => localStorage.getItem("lcx-lsp-language") || "go");
  const [lspStatus, setLSPStatus] = useState<LSPStatus>({
    running: false,
    pendingRequests: 0,
    diagnostics: 0
  });
  const [lspDiagnosticPath, setLSPDiagnosticPath] = useState("");
  const [lspDiagnostics, setLSPDiagnostics] = useState<LSPDiagnostic[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("activity");
  const [cleanupWorktreeOpen, setCleanupWorktreeOpen] = useState(false);
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
    localStorage.setItem("lcx-lsp-command", lspCommand);
    localStorage.setItem("lcx-lsp-args", lspArgs);
    localStorage.setItem("lcx-lsp-language", lspLanguage);
  }, [lspArgs, lspCommand, lspLanguage]);

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
    setLSPDiagnostics([]);
    if (!state.workspace) {
      setLSPStatus({ running: false, pendingRequests: 0, diagnostics: 0 });
      return;
    }
    bridge.lspStatus(selected || "")
      .then(setLSPStatus)
      .catch(() => setLSPStatus({ running: false, pendingRequests: 0, diagnostics: 0 }));
  }, [selected, state.workspace]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setMessageAtLatest(true);
      setWorkflowSummary(null);
      setSubagents([]);
      setCheckpoints([]);
      return;
    }
    Promise.all([
      bridge.messagePage(selected, -1, MESSAGE_PAGE_SIZE),
      bridge.workflowSummary(selected),
      bridge.subagentTree(selected),
      bridge.sessionCheckpoints(selected, 20),
    ]).then(([page, summary, nextSubagents, nextCheckpoints]) => {
      setMessages(page.messages);
      setMessageAtLatest(true);
      setWorkflowSummary(summary);
      setSubagents(nextSubagents);
      setCheckpoints(nextCheckpoints);
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
      event.type === "lsp.started" ||
      event.type === "lsp.stopped" ||
      (event.type === "tool.end" && event.sessionId === selected)
    ) {
      bridge.lspStatus(selected || "").then(setLSPStatus).catch(() => undefined);
    }

    if (
      selected &&
      event.sessionId === selected &&
      (event.type === "subagent.spawned" || event.type === "subagent.event" || event.type === "subagent.stopped")
    ) {
      Promise.all([
        bridge.subagentTree(selected),
        bridge.sessionCheckpoints(selected, 20),
      ]).then(([nextSubagents, nextCheckpoints]) => {
        setSubagents(nextSubagents);
        setCheckpoints(nextCheckpoints);
      }).catch(() => undefined);
    }

    if (
      event.sessionId &&
      event.sessionId === selected &&
      (event.type === "session.complete" || event.type === "session.interrupted" || event.type === "tool.end" || event.type === "workflow.transition" || event.type === "workflow.gate_waiting" || event.type === "workflow.approved")
    ) {
      Promise.all([
        messageAtLatest ? bridge.messagePage(selected, -1, MESSAGE_PAGE_SIZE) : Promise.resolve(null),
        bridge.workflowSummary(selected),
      ]).then(([page, summary]) => {
        if (page) {
          setMessages((currentMessages) =>
            mergeMessages(currentMessages, page.messages).slice(-MAX_LOADED_MESSAGES)
          );
        }
        setWorkflowSummary(summary);
      }).catch(() => undefined);
    }
  }), [messageAtLatest, selected]);

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
    const runningThreads: SidebarGroup["sessions"] = [];
    const attentionThreads: SidebarGroup["sessions"] = [];
    const pinnedThreads: SidebarGroup["sessions"] = [];
    const recentThreads: SidebarGroup["sessions"] = [];
    const archivedThreads: SidebarGroup["sessions"] = [];

    for (const session of state.sessions) {
      const ui = sessionUI(session);
      if (ui.parentSessionId) continue;
      const active = activeRunIds.has(session.id);
      const thread = {
        session,
        runtime: sessionRuntime(session, state.workspace),
        title: ui.title,
        active,
        pinned: ui.pinned,
        archived: ui.archived,
        statusLabel: session.status === "running" && !active
          ? t.interrupted
          : statusLabel(session.status, active)
      };

      if (ui.archived) {
        archivedThreads.push(thread);
      } else if (active) {
        runningThreads.push(thread);
      } else if (session.status === "waiting_gate" || session.error || session.status === "running") {
        attentionThreads.push(thread);
      } else if (ui.pinned) {
        pinnedThreads.push(thread);
      } else {
        recentThreads.push(thread);
      }
    }

    return [
      { key: "running", label: t.runningThreads, sessions: runningThreads },
      { key: "attention", label: t.attentionThreads, sessions: attentionThreads },
      { key: "pinned", label: t.pinnedThreads, sessions: pinnedThreads },
      { key: "recent", label: t.recentThreads, sessions: recentThreads },
      { key: "archived", label: t.archivedThreads, sessions: archivedThreads }
    ].filter((group) => group.sessions.length > 0);
  }, [
    activeRunIds,
    state.sessions,
    state.workspace,
    t.archivedThreads,
    t.attentionThreads,
    t.interrupted,
    t.pinnedThreads,
    t.recentThreads,
    t.runningThreads
  ]);


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
    const [session, page, summary, nextSubagents, nextCheckpoints] = await Promise.all([
      bridge.getSession(sessionId),
      bridge.messagePage(sessionId, -1, MESSAGE_PAGE_SIZE),
      bridge.workflowSummary(sessionId),
      bridge.subagentTree(sessionId),
      bridge.sessionCheckpoints(sessionId, 20),
    ]);
    if (sessionId === selected) {
      setMessages(page.messages);
      setMessageAtLatest(true);
      setWorkflowSummary(summary);
      setSubagents(nextSubagents);
      setCheckpoints(nextCheckpoints);
    }
    setState((currentState) => ({
      ...currentState,
      sessions: currentState.sessions.map((item) => item.id === session.id ? session : item)
    }));
  }

  async function loadOlderMessages() {
    if (!selected || messageLoadingOlder || messages.length === 0) return;
    const before = messages[0].seq;
    if (before <= 0) return;

    setMessageLoadingOlder(true);
    try {
      const page = await bridge.messagePage(selected, before, MESSAGE_PAGE_SIZE);
      setMessages((currentMessages) => {
        const merged = mergeMessages(page.messages, currentMessages);
        if (merged.length > MAX_LOADED_MESSAGES) {
          setMessageAtLatest(false);
          return merged.slice(0, MAX_LOADED_MESSAGES);
        }
        return merged;
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setMessageLoadingOlder(false);
    }
  }

  async function jumpToLatestMessages() {
    if (!selected) return;
    setMessageLoadingOlder(true);
    try {
      const page = await bridge.messagePage(selected, -1, MESSAGE_PAGE_SIZE);
      setMessages(page.messages);
      setMessageAtLatest(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setMessageLoadingOlder(false);
    }
  }

  async function pickWorkspace() {
    setError("");
    try {
      const next = await bridge.pickWorkspace();
      setState(next);
      setRoute({ kind: "new-task" });
      setMessages([]);
      setMessageAtLatest(true);
      setWorkflowSummary(null);
      setContextPaths([]);
      setRuntimeKind("local");
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
      setMessageAtLatest(true);
      setWorkflowSummary(null);
      setEvents([]);
      setSidebarOpen(false);
    } catch (err) {
      setError(String(err));
    }
  }

  function mergeContextPaths(paths: string[]) {
    setContextPaths((current) => Array.from(new Set([...current, ...paths])).slice(0, 32));
  }

  async function pickContextFiles() {
    if (!state.workspace) return;
    try {
      mergeContextPaths(await bridge.pickContextFiles());
    } catch (err) {
      setError(String(err));
    }
  }

  async function pickContextDirectory() {
    if (!state.workspace) return;
    try {
      mergeContextPaths(await bridge.pickContextDirectory());
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
      const session = await bridge.createSessionWithRuntime(task, contextPaths, runtimeKind, "HEAD");
      setState((currentState) => ({
        ...currentState,
        sessions: [session, ...currentState.sessions.filter((item) => item.id !== session.id)]
      }));
      setRoute({ kind: "thread", sessionId: session.id });
      setMessages([]);
      setMessageAtLatest(true);
      setWorkflowSummary(null);
      setGoal("");
      setContextPaths([]);
      setRuntimeKind("local");
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

  async function retryCurrent() {
    if (!current || running || busy) return;
    setBusy(true);
    setError("");
    try {
      await bridge.continueAgent(
        current.id,
        "Retry the previous incomplete attempt. Re-read the durable thread context, identify why the previous run stopped or failed, continue from the current workspace state, and verify the result.",
        agentConfig()
      );
      const nextState = await bridge.state();
      setState(nextState);
      await refreshCurrent(current.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendReviewInstruction(path: string, instruction: string) {
    if (!current || running || busy) return;
    setBusy(true);
    setError("");
    try {
      const prompt = [
        `Review feedback for ${path}:`,
        instruction,
        "",
        "Address this feedback in the current task, inspect the relevant code before editing, and verify the resulting change."
      ].join("\n");
      await bridge.continueAgent(current.id, prompt, agentConfig());
      const nextState = await bridge.state();
      setState(nextState);
      setRoute({ kind: "thread", sessionId: current.id });
      setInspectorOpen(false);
      await refreshCurrent(current.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function startLSP() {
    if (!state.workspace || busy || !lspCommand.trim()) return;
    setBusy(true);
    setError("");
    try {
      const status = await bridge.startLSP(selected || "", {
        name: lspCommand.trim(),
        command: lspCommand.trim(),
        args: splitCommandArgs(lspArgs),
        languageId: lspLanguage.trim() || undefined
      });
      setLSPStatus(status);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function stopLSP() {
    if (!state.workspace || busy) return;
    setBusy(true);
    setError("");
    try {
      await bridge.stopLSP(selected || "");
      setLSPStatus(await bridge.lspStatus(selected || ""));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function refreshLSPDiagnostics() {
    if (!state.workspace || !lspStatus.running || !lspDiagnosticPath.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const items = await bridge.lspDiagnostics(selected || "", lspDiagnosticPath.trim());
      setLSPDiagnostics(items);
      setLSPStatus(await bridge.lspStatus(selected || ""));
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

  async function cleanupCurrentWorktree(force: boolean) {
    if (!current || currentRuntime.kind !== "worktree" || running || busy) return;
    setBusy(true);
    setError("");
    try {
      await bridge.removeSessionWorktree(current.id, force);
      const nextState = await bridge.state();
      setState(nextState);
      setCleanupWorktreeOpen(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function updateSessionUI(sessionId: string, patch: { title?: string; pinned?: boolean; archived?: boolean }) {
    setError("");
    try {
      const updated = await bridge.updateSessionUI(sessionId, patch);
      setState((currentState) => ({
        ...currentState,
        sessions: currentState.sessions.map((session) => session.id === updated.id ? updated : session)
      }));
      if (patch.archived === true && selected === sessionId) {
        setRoute({ kind: "new-task" });
        setMessages([]);
        setMessageAtLatest(true);
        setWorkflowSummary(null);
      }
    } catch (err) {
      setError(String(err));
    }
  }

  function newTask() {
    setRoute({ kind: "new-task" });
    setMessages([]);
    setWorkflowSummary(null);
    setGoal("");
    setContextPaths([]);
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
            onRemoveContextPath={(path) => setContextPaths((current) => current.filter((item) => item !== path))}
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
