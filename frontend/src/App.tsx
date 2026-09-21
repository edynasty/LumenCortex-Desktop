import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  CircleCheck,
  Code2,
  Folder,
  Languages,
  Menu,
  PanelRight,
  Plus,
  Settings2,
  Square,
  SquareTerminal,
  X
} from "lucide-react";
import { NewTaskComposer } from "./components/composer/NewTaskComposer";
import { ProviderSettingsPanel } from "./components/provider/ProviderSettingsPanel";
import { bridge, onRuntimeEvent } from "./lib/bridge";
import type { AgentConfig, Message, ProviderCatalog, RuntimeEvent, Session, WorkspaceState } from "./types";

const MAX_VISIBLE_EVENTS = 180;
const MAX_VISIBLE_MESSAGES = 100;

type Locale = "zh-CN" | "en";
type InspectorTab = "activity" | "run" | "terminal";
type WorkspaceView = "workspace" | "providers";
type Policy = "read-only" | "workspace" | "full";

const copy = {
  "zh-CN": {
    newTask: "新任务",
    openProject: "打开项目",
    changeProject: "切换项目",
    project: "项目",
    sessions: "会话",
    noSessions: "还没有会话",
    today: "最近",
    runningThreads: "进行中",
    attentionThreads: "需要处理",
    recentThreads: "最近",
    activity: "活动",
    run: "运行",
    terminal: "终端",
    settings: "设置",
    providers: "提供商",
    providerConfig: "Provider 配置",
    providerSettings: "模型与提供商",
    providerConfigHint: "未打开项目时保存到 ~/.config/lumencortex/lumencortex.json；打开项目后保存到项目根目录 lumencortex.json，项目配置覆盖全局。API Key 推荐使用 {env:VAR_NAME}。",
    saveConfig: "保存配置",
    modelSelect: "模型",
    noModels: "未配置模型，将使用 LCX_MODEL 环境变量",
    modelFallback: "环境模型",
    runtimeReady: "运行时待命",
    runtimeOnline: "运行时在线",
    runtimeOffline: "运行时离线",
    openRepoTitle: "打开一个代码仓库",
    openRepoBody: "LumenCortex 会在本地工作区中运行 Go Agent、保存会话，并记录可审查的工具执行轨迹。",
    chooseFolder: "选择文件夹",
    buildTitle: "想让 LumenCortex 做什么？",
    buildBody: "描述任务后会创建一个独立会话并立即启动 Agent。不同会话可以并行运行。",
    composerPlaceholder: "描述一个编码任务，例如：修复登录超时并补充测试",
    composerHint: "Enter 开始 · Shift+Enter 换行",
    start: "开始",
    resume: "继续",
    stop: "停止",
    running: "正在运行",
    model: "模型",
    baseUrl: "Base URL",
    endpoint: "完整 Endpoint",
    apiKey: "API Key",
    policy: "权限",
    maxSteps: "最大步骤",
    envFallback: "留空时使用 LCX_* 环境变量。API Key 不写入工作区数据库。",
    readOnly: "只读",
    workspace: "工作区",
    full: "完全访问",
    runtime: "运行时",
    workingMemory: "工作内存",
    softBudget: "软限制",
    hardBudget: "硬限制",
    maxAgents: "最大 Agent",
    noActivity: "Agent 的工具调用和运行事件会显示在这里。",
    noMessages: "这个会话还没有消息。启动 Agent 后，执行过程会出现在这里。",
    shellCommand: "命令",
    runCommand: "运行命令",
    shellHint: "用于调试当前会话。Agent 运行时会禁用手动命令。",
    finalAnswer: "最终结果",
    provider: "Provider",
    local: "本地",
    active: "运行中",
    status: "状态",
    language: "English",
    inspector: "活动面板",
    close: "关闭",
    collapseSidebar: "收起侧栏",
    expandSidebar: "打开侧栏",
    startAnother: "开始另一个任务",
    backToWorkspace: "返回工作区",
    newTaskSubtitle: "描述任务，选择项目、模型和权限，然后直接开始。运行细节和工具轨迹会在任务开始后按需显示。",
    waiting: "等待确认",
    created: "待启动",
    completed: "已完成",
    interrupted: "已中断",
    unknown: "未知",
    error: "发生错误",
    messageRoleUser: "你",
    messageRoleAssistant: "LumenCortex",
    messageRoleTool: "工具",
    messageRoleSystem: "系统"
  },
  en: {
    newTask: "New task",
    openProject: "Open project",
    changeProject: "Change project",
    project: "Project",
    sessions: "Threads",
    noSessions: "No threads yet",
    today: "Recent",
    runningThreads: "Running",
    attentionThreads: "Needs attention",
    recentThreads: "Recent",
    activity: "Activity",
    run: "Run",
    terminal: "Terminal",
    settings: "Settings",
    providers: "Providers",
    providerConfig: "Provider configuration",
    providerSettings: "Models & providers",
    providerConfigHint: "Without a project, settings are saved to ~/.config/lumencortex/lumencortex.json. With a project open, lumencortex.json in the project root overrides global settings. Prefer {env:VAR_NAME} for API keys.",
    saveConfig: "Save configuration",
    modelSelect: "Model",
    noModels: "No configured models; LCX_MODEL will be used",
    modelFallback: "Environment model",
    runtimeReady: "Runtime ready",
    runtimeOnline: "Runtime online",
    runtimeOffline: "Runtime offline",
    openRepoTitle: "Open a code repository",
    openRepoBody: "LumenCortex runs the Go agent locally, keeps durable sessions, and records a reviewable tool execution trail.",
    chooseFolder: "Choose folder",
    buildTitle: "What should LumenCortex build?",
    buildBody: "Describe a task to create a separate thread and start the agent immediately. Threads can run in parallel.",
    composerPlaceholder: "Describe a coding task, e.g. fix login timeout and add tests",
    composerHint: "Enter to start · Shift+Enter for a new line",
    start: "Start",
    resume: "Resume",
    stop: "Stop",
    running: "Running",
    model: "Model",
    baseUrl: "Base URL",
    endpoint: "Exact endpoint",
    apiKey: "API key",
    policy: "Permissions",
    maxSteps: "Max steps",
    envFallback: "Empty fields fall back to LCX_* environment variables. API keys are not stored in the workspace database.",
    readOnly: "Read only",
    workspace: "Workspace",
    full: "Full access",
    runtime: "Runtime",
    workingMemory: "Working memory",
    softBudget: "Soft budget",
    hardBudget: "Hard budget",
    maxAgents: "Max agents",
    noActivity: "Agent tool calls and runtime events will appear here.",
    noMessages: "This thread has no messages yet. Start the agent to see its execution here.",
    shellCommand: "Command",
    runCommand: "Run command",
    shellHint: "For debugging the current thread. Manual commands are disabled while the agent is running.",
    finalAnswer: "Final result",
    provider: "Provider",
    local: "Local",
    active: "Active",
    status: "Status",
    language: "中文",
    inspector: "Activity panel",
    close: "Close",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Open sidebar",
    startAnother: "Start another task",
    backToWorkspace: "Back to workspace",
    newTaskSubtitle: "Describe the task, choose a project, model, and permission profile, then start. Runtime detail appears only when it becomes useful.",
    waiting: "Waiting for approval",
    created: "Ready",
    completed: "Completed",
    interrupted: "Interrupted",
    unknown: "Unknown",
    error: "Something went wrong",
    messageRoleUser: "You",
    messageRoleAssistant: "LumenCortex",
    messageRoleTool: "Tool",
    messageRoleSystem: "System"
  }
} as const;

type IconName = "menu" | "plus" | "folder" | "panel" | "play" | "stop" | "terminal" | "globe" | "chevron" | "close";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const props = { size, strokeWidth: 1.7, "aria-hidden": true as const };
  switch (name) {
    case "menu": return <Menu {...props} />;
    case "plus": return <Plus {...props} />;
    case "folder": return <Folder {...props} />;
    case "panel": return <PanelRight {...props} />;
    case "play": return <ArrowUp {...props} />;
    case "stop": return <Square {...props} />;
    case "terminal": return <SquareTerminal {...props} />;
    case "globe": return <Languages {...props} />;
    case "chevron": return <ChevronRight {...props} />;
    case "close": return <X {...props} />;
  }
}

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

function bytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function normalizePayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return { content: value };
    }
  }
  return {};
}

function messageText(message: Message) {
  const payload = normalizePayload(message.json);
  if (typeof payload.content === "string" && payload.content.trim()) return payload.content;
  if (Array.isArray(payload.tool_calls)) {
    const names = payload.tool_calls
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const call = item as Record<string, unknown>;
        return typeof call.name === "string" ? call.name : "";
      })
      .filter(Boolean);
    if (names.length) return `Tool calls: ${names.join(", ")}`;
  }
  const raw = JSON.stringify(payload, null, 2);
  return raw === "{}" ? "(empty message)" : raw;
}

function roleClass(role: string) {
  if (role === "assistant") return "assistant";
  if (role === "tool") return "tool";
  if (role === "system") return "system";
  return "user";
}

function formatClock(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("lcx-locale") === "en" ? "en" : "zh-CN"));
  const t = copy[locale];
  const [state, setState] = useState<WorkspaceState>({ workspace: "", sessions: [], activeRuns: [] });
  const [selected, setSelected] = useState("");
  const [goal, setGoal] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("workspace");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bridge.state().then((next) => {
      setState(next);
      if (next.sessions.length) setSelected(next.sessions[0].id);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem("lcx-locale", locale);
  }, [locale]);

  useEffect(() => {
    bridge.providerCatalog().then((next) => {
      setCatalog(next);
      setModelRef((current) => current || next.model || "");
    }).catch((err) => setError(String(err)));
  }, [state.workspace]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    bridge.recentMessages(selected, MAX_VISIBLE_MESSAGES).then(setMessages).catch(() => undefined);
  }, [selected]);

  useEffect(() => onRuntimeEvent((event) => {
    setEvents((current) => [...current, event].slice(-MAX_VISIBLE_EVENTS));

    if (
      event.type === "run.started" ||
      event.type === "run.stopped" ||
      event.type === "session.complete" ||
      event.type === "session.interrupted"
    ) {
      bridge.state().then(setState).catch(() => undefined);
    }

    if (
      event.sessionId &&
      event.sessionId === selected &&
      (event.type === "session.complete" || event.type === "session.interrupted" || event.type === "tool.end" || event.type === "workflow.transition")
    ) {
      bridge.recentMessages(selected, MAX_VISIBLE_MESSAGES).then(setMessages).catch(() => undefined);
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

  const sessionGroups = useMemo(() => {
    const runningSessions: Session[] = [];
    const attentionSessions: Session[] = [];
    const recentSessions: Session[] = [];

    for (const session of state.sessions) {
      if (activeRunIds.has(session.id)) {
        runningSessions.push(session);
      } else if (session.status === "waiting_gate" || session.error) {
        attentionSessions.push(session);
      } else {
        recentSessions.push(session);
      }
    }

    return [
      { key: "running", label: t.runningThreads, sessions: runningSessions },
      { key: "attention", label: t.attentionThreads, sessions: attentionSessions },
      { key: "recent", label: t.recentThreads, sessions: recentSessions }
    ].filter((group) => group.sessions.length > 0);
  }, [activeRunIds, state.sessions, t.attentionThreads, t.recentThreads, t.runningThreads]);


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

  function roleLabel(role: string) {
    if (role === "assistant") return t.messageRoleAssistant;
    if (role === "tool") return t.messageRoleTool;
    if (role === "system") return t.messageRoleSystem;
    return t.messageRoleUser;
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
    const [session, recent] = await Promise.all([
      bridge.getSession(sessionId),
      bridge.recentMessages(sessionId, MAX_VISIBLE_MESSAGES)
    ]);
    if (sessionId === selected) setMessages(recent);
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
      setSelected("");
      setMessages([]);
      setEvents([]);
      setWorkspaceView("workspace");
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

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    const task = goal.trim();
    if (!task || !state.workspace || busy) return;
    setBusy(true);
    setError("");
    try {
      const session = await bridge.createSession(task);
      setState((currentState) => ({
        ...currentState,
        sessions: [session, ...currentState.sessions.filter((item) => item.id !== session.id)]
      }));
      setSelected(session.id);
      setMessages([]);
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

  async function runShell(event: FormEvent) {
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
    setSelected("");
    setMessages([]);
    setGoal("");
    setWorkspaceView("workspace");
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

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <div className="brand-mark" aria-hidden>LC</div>
          <div className="brand-copy">
            <strong>LumenCortex</strong>
            <span>Desktop</span>
          </div>
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label={t.close}>
            <Icon name="close" />
          </button>
        </div>

        <button className="new-task-button" onClick={newTask}>
          <Icon name="plus" size={15} />
          <span>{t.newTask}</span>
        </button>

        <button className="project-button" onClick={pickWorkspace}>
          <span className="project-icon"><Icon name="folder" size={16} /></span>
          <span className="project-copy">
            <small>{t.project}</small>
            <strong>{state.workspace ? basename(state.workspace) : t.openProject}</strong>
          </span>
          <Icon name="chevron" size={14} />
        </button>

        <div className="sidebar-section-title sidebar-section-summary">
          <span>{t.sessions}</span>
          <span>{state.sessions.length}</span>
        </div>

        <div className="thread-list">
          {sessionGroups.map((group) => (
            <section className="thread-group" key={group.key}>
              <div className="thread-group-title">
                <span>{group.label}</span>
                <span>{group.sessions.length}</span>
              </div>
              {group.sessions.map((session) => {
                const isActive = activeRunIds.has(session.id);
                return (
                  <button
                    key={session.id}
                    className={`thread-item ${session.id === selected && workspaceView === "workspace" ? "selected" : ""}`}
                    onClick={() => {
                      setSelected(session.id);
                      setWorkspaceView("workspace");
                      setSidebarOpen(false);
                    }}
                  >
                    <span className={`thread-dot ${isActive ? "live" : session.status}`} />
                    <span className="thread-copy">
                      <strong>{session.goal}</strong>
                      <small>{statusLabel(session.status, isActive)} · {formatClock(session.updatedAt)}</small>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
          {!state.sessions.length && <div className="sidebar-empty">{t.noSessions}</div>}
        </div>

        <div className="sidebar-footer">
          <div className="runtime-line">
            <span className={`runtime-dot ${health ? "online" : state.workspace ? "offline" : "ready"}`} />
            <span>{health ? t.runtimeOnline : state.workspace ? t.runtimeOffline : t.runtimeReady}</span>
            {health?.version && <code>{health.version}</code>}
          </div>
          <button
            className={`footer-button provider-settings-entry ${workspaceView === "providers" ? "active" : ""}`}
            onClick={() => {
              setWorkspaceView("providers");
              setInspectorOpen(false);
              setSidebarOpen(false);
            }}
          >
            <Settings2 size={14} strokeWidth={1.7} aria-hidden />
            <span>{t.providerSettings}</span>
          </button>
          <button className="footer-button" onClick={switchLocale}>
            <Icon name="globe" size={14} />
            <span>{t.language}</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label={t.close} />}

      <section className={`workspace-shell ${inspectorOpen && workspaceView === "workspace" ? "with-inspector" : ""}`}>
        <main className="workspace-main">
          <header className="topbar">
            <div className="topbar-left">
              <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label={t.expandSidebar}>
                <Icon name="menu" />
              </button>
              <div className="title-stack">
                <strong>{workspaceView === "providers" ? t.providerSettings : current?.goal || (state.workspace ? basename(state.workspace) : "LumenCortex")}</strong>
                <span>
                  {workspaceView === "providers"
                    ? (state.workspace ? `${t.project} · ${basename(state.workspace)}` : t.providerConfig)
                    : state.workspace
                      ? `${t.local}${current?.model ? ` · ${current.model}` : ""}${current ? ` · ${statusLabel(current.status, running)}` : ""}`
                      : t.runtimeReady}
                </span>
              </div>
            </div>

            <div className="topbar-actions">
              {workspaceView === "providers" && (
                <button className="toolbar-button" onClick={() => setWorkspaceView("workspace")}>
                  <Code2 size={14} strokeWidth={1.7} aria-hidden />
                  <span>{t.backToWorkspace}</span>
                </button>
              )}
              {workspaceView === "workspace" && current && running && (
                <button className="toolbar-button stop" onClick={cancelAgent} disabled={busy}>
                  <Icon name="stop" size={14} />
                  <span>{t.stop}</span>
                </button>
              )}
              {workspaceView === "workspace" && current && !running && (current.status === "created" || current.status === "interrupted") && (
                <button className="toolbar-button" onClick={() => startAgent()} disabled={busy}>
                  <Icon name="play" size={14} />
                  <span>{current.status === "interrupted" ? t.resume : t.start}</span>
                </button>
              )}
              {workspaceView === "workspace" && (
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

          {workspaceView === "providers" ? (
            <ProviderSettingsPanel
              locale={locale}
              workspace={state.workspace}
              effectiveCatalog={catalog}
              selectedModelRef={modelRef}
              onSelectedModelRef={setModelRef}
              onEffectiveCatalogChange={setCatalog}
              onError={setError}
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
                setWorkspaceView("providers");
                setInspectorOpen(false);
              }}
              onSubmit={submitTask}
              onKeyDown={onComposerKeyDown}
            />
          ) : (
            <div className="thread-view">
              <div className="thread-content">
                <section className="task-intro">
                  <div className="task-icon"><Code2 size={15} strokeWidth={1.7} aria-hidden /></div>
                  <div>
                    <span>{t.newTask}</span>
                    <h1>{current.goal}</h1>
                    <div className="task-meta">
                      <span className={`status-pill ${running ? "running" : current.status}`}>{statusLabel(current.status, running)}</span>
                      {current.provider && <span>{current.provider}</span>}
                      {current.model && <span>{current.model}</span>}
                    </div>
                  </div>
                </section>

                <section className="message-list">
                  {messages.map((message) => (
                    <article key={`${message.seq}-${message.role}`} className={`message-row ${roleClass(message.role)}`}>
                      <div className="message-avatar">{message.role === "assistant" ? "LC" : message.role === "tool" ? "T" : message.role === "system" ? "S" : "U"}</div>
                      <div className="message-body">
                        <div className="message-head">
                          <strong>{roleLabel(message.role)}</strong>
                          <span>#{message.seq}</span>
                        </div>
                        <pre>{messageText(message)}</pre>
                      </div>
                    </article>
                  ))}

                  {!messages.length && (
                    <div className="inline-empty">
                      {running && <span className="thinking-pulse"><i /><i /><i /></span>}
                      <p>{running ? t.running : t.noMessages}</p>
                    </div>
                  )}
                </section>

                {current.final && (
                  <section className="final-result">
                    <div className="final-label"><CircleCheck size={14} strokeWidth={1.7} aria-hidden /> {t.finalAnswer}</div>
                    <p>{current.final}</p>
                  </section>
                )}
              </div>
            </div>
          )}

          {workspaceView === "workspace" && state.workspace && current && (
            <div className="composer-dock">
              <form className="composer" onSubmit={submitTask}>
                <textarea
                  ref={composerRef}
                  value={goal}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setGoal(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder={current ? `${t.startAnother}…` : t.composerPlaceholder}
                  rows={1}
                />
                <div className="composer-footer">
                  <div className="composer-context">
                    <span><Icon name="folder" size={13} /> {basename(state.workspace)}</span>
                    <select
                      className="composer-model-select"
                      value={modelRef}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => setModelRef(event.target.value)}
                      aria-label={t.modelSelect}
                    >
                      <option value="">{t.noModels}</option>
                      {configuredModels.map((item) => (
                        <option key={item.ref} value={item.ref}>{item.label}</option>
                      ))}
                    </select>
                    <span>{policy === "read-only" ? t.readOnly : policy === "full" ? t.full : t.workspace}</span>
                  </div>
                  <div className="composer-actions">
                    <span className="composer-hint">{t.composerHint}</span>
                    <button className="send-button" disabled={busy || !goal.trim()} aria-label={t.start}>
                      <Icon name="play" size={15} />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </main>

        {inspectorOpen && workspaceView === "workspace" && (
          <aside className="inspector">
            <div className="inspector-head">
              <div className="inspector-tabs">
                <button className={inspectorTab === "activity" ? "active" : ""} onClick={() => setInspectorTab("activity")}>{t.activity}</button>
                <button className={inspectorTab === "run" ? "active" : ""} onClick={() => setInspectorTab("run")}>{t.run}</button>
                <button className={inspectorTab === "terminal" ? "active" : ""} onClick={() => setInspectorTab("terminal")}>{t.terminal}</button>
              </div>
              <button className="icon-button inspector-close" onClick={() => setInspectorOpen(false)} aria-label={t.close}>
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="inspector-body">
              {inspectorTab === "activity" && (
                <div className="activity-list">
                  {selectedEvents.slice().reverse().map((event) => (
                    <div className="activity-item" key={`${event.seq}-${event.at}`}>
                      <div className="activity-rail"><span /></div>
                      <div className="activity-copy">
                        <div><strong>{event.type}</strong><time>{formatClock(event.at)}</time></div>
                        {event.data && <code>{JSON.stringify(event.data)}</code>}
                      </div>
                    </div>
                  ))}
                  {!selectedEvents.length && <div className="inspector-empty">{t.noActivity}</div>}
                </div>
              )}

              {inspectorTab === "run" && (
                <div className="run-settings">
                  <div className="settings-group">
                    <div className="settings-title">{t.provider}</div>
                    <label>{t.modelSelect}
                      <select value={modelRef} onChange={(event: ChangeEvent<HTMLSelectElement>) => setModelRef(event.target.value)}>
                        <option value="">{t.noModels}</option>
                        {configuredModels.map((item) => <option key={item.ref} value={item.ref}>{item.label}</option>)}
                      </select>
                    </label>
                    <button
                      className="provider-link-button"
                      type="button"
                      onClick={() => {
                        setWorkspaceView("providers");
                        setInspectorOpen(false);
                      }}
                    >
                      {t.providerConfig}
                    </button>
                    <p className="settings-note">{t.envFallback}</p>
                  </div>

                  <div className="settings-group">
                    <div className="settings-title">{t.run}</div>
                    <label>{t.policy}
                      <select value={policy} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPolicy(event.target.value as Policy)}>
                        <option value="read-only">{t.readOnly}</option>
                        <option value="workspace">{t.workspace}</option>
                        <option value="full">{t.full}</option>
                      </select>
                    </label>
                    <label>{t.maxSteps}<input type="number" min={1} max={200} value={maxSteps} onChange={(event: ChangeEvent<HTMLInputElement>) => setMaxSteps(Math.max(1, Number(event.target.value) || 1))} /></label>
                  </div>

                  <div className="settings-group runtime-group">
                    <div className="settings-title">{t.runtime}</div>
                    <dl>
                      <div><dt>{t.workingMemory}</dt><dd>{bytes(health?.usedBytes)}</dd></div>
                      <div><dt>{t.softBudget}</dt><dd>{bytes(health?.budget.softBytes)}</dd></div>
                      <div><dt>{t.hardBudget}</dt><dd>{bytes(health?.budget.hardBytes)}</dd></div>
                      <div><dt>{t.maxAgents}</dt><dd>{health?.budget.maxAgents ?? "—"}</dd></div>
                    </dl>
                    <div className="memory-meter"><span style={{ width: `${pressure}%` }} /></div>
                  </div>
                </div>
              )}

              {inspectorTab === "terminal" && (
                <form className="terminal-pane" onSubmit={runShell}>
                  <div className="terminal-title"><Icon name="terminal" size={15} /> {t.shellCommand}</div>
                  <textarea value={command} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCommand(event.target.value)} rows={7} disabled={!selected || running} />
                  <button className="secondary-action" disabled={busy || !selected || running || !command.trim()}>{t.runCommand}</button>
                  <p>{t.shellHint}</p>
                </form>
              )}
            </div>
          </aside>
        )}
      </section>

      {error && (
        <div className="error-toast" role="alert">
          <strong>{t.error}</strong>
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label={t.close}><Icon name="close" size={14} /></button>
        </div>
      )}
    </div>
  );
}
