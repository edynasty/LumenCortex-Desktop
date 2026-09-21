import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  Folder,
  Languages,
  Menu,
  PanelRight,
  Plus,
  Sparkles,
  Square,
  SquareTerminal,
  X
} from "lucide-react";
import { bridge, onRuntimeEvent } from "./lib/bridge";
import type { AgentConfig, Message, ProviderCatalog, RuntimeEvent, Session, WorkspaceState } from "./types";

const MAX_VISIBLE_EVENTS = 180;
const MAX_VISIBLE_MESSAGES = 100;

type Locale = "zh-CN" | "en";
type InspectorTab = "activity" | "run" | "providers" | "terminal";
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
    activity: "活动",
    run: "运行",
    terminal: "终端",
    settings: "设置",
    providers: "提供商",
    providerConfig: "Provider 配置",
    providerConfigHint: "配置保存在工作区根目录 lumencortex.json。API Key 推荐使用 {env:VAR_NAME}，不要直接写入密钥。",
    saveConfig: "保存配置",
    modelSelect: "模型",
    noModels: "未配置模型，将使用 LCX_MODEL 环境变量",
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
    activity: "Activity",
    run: "Run",
    terminal: "Terminal",
    settings: "Settings",
    providers: "Providers",
    providerConfig: "Provider configuration",
    providerConfigHint: "Stored as lumencortex.json in the workspace root. Prefer {env:VAR_NAME} for API keys instead of storing secrets directly.",
    saveConfig: "Save configuration",
    modelSelect: "Model",
    noModels: "No configured models; LCX_MODEL will be used",
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

type IconName = "menu" | "plus" | "folder" | "panel" | "play" | "stop" | "terminal" | "globe" | "chevron" | "spark" | "close";

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
    case "spark": return <Sparkles {...props} />;
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
  const [state, setState] = useState<WorkspaceState>({ workspace: "", sessions: [] });
  const [selected, setSelected] = useState("");
  const [goal, setGoal] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [activeRuns, setActiveRuns] = useState<Record<string, boolean>>({});
  const [catalog, setCatalog] = useState<ProviderCatalog>({ providers: {} });
  const [modelRef, setModelRef] = useState("");
  const [providerJSON, setProviderJSON] = useState("");
  const [providerDirty, setProviderDirty] = useState(false);
  const [policy, setPolicy] = useState<Policy>("workspace");
  const [maxSteps, setMaxSteps] = useState(24);
  const [command, setCommand] = useState("git status --short");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth > 1180);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("activity");
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
    if (!state.workspace) {
      setCatalog({ providers: {} });
      setModelRef("");
      setProviderJSON("");
      setProviderDirty(false);
      return;
    }
    bridge.providerCatalog().then((next) => {
      setCatalog(next);
      setModelRef((current) => current || next.model || "");
      setProviderJSON(JSON.stringify(next, null, 2));
      setProviderDirty(false);
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

    if (event.type === "session.complete" || event.type === "session.interrupted") {
      if (event.sessionId) {
        setActiveRuns((current) => ({ ...current, [event.sessionId as string]: false }));
      }
      bridge.listSessions(100, 0)
        .then((sessions) => setState((current) => ({ ...current, sessions })))
        .catch(() => undefined);
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
  const running = selected ? Boolean(activeRuns[selected]) : false;
  const health = state.health;
  const pressure = health && health.budget.softBytes > 0 ? Math.min(100, (health.usedBytes / health.budget.softBytes) * 100) : 0;
  const selectedEvents = useMemo(
    () => events.filter((event) => !selected || !event.sessionId || event.sessionId === selected),
    [events, selected]
  );

  const configuredModels = useMemo(() => {
    return Object.entries(catalog.providers || {}).flatMap(([providerID, provider]) =>
      Object.entries(provider.models || {}).map(([modelID, definition]) => ({
        ref: providerID + "/" + modelID,
        label: (provider.name || providerID) + " / " + (definition.name || modelID)
      }))
    );
  }, [catalog]);

  const selectedModelLabel = useMemo(
    () => configuredModels.find((item) => item.ref === modelRef)?.label || modelRef,
    [configuredModels, modelRef]
  );

  function statusLabel(status?: string) {
    if (running) return t.active;
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
      setSelected(next.sessions[0]?.id || "");
      setMessages([]);
      setEvents([]);
      setActiveRuns({});
      setSidebarOpen(false);
    } catch (err) {
      setError(String(err));
    }
  }

  async function startAgent(sessionId = selected) {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    setActiveRuns((currentRuns) => ({ ...currentRuns, [sessionId]: true }));
    try {
      const session = await bridge.startAgent(sessionId, agentConfig());
      setState((currentState) => ({
        ...currentState,
        sessions: currentState.sessions.map((item) => item.id === session.id ? session : item)
      }));
    } catch (err) {
      setActiveRuns((currentRuns) => ({ ...currentRuns, [sessionId]: false }));
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
      setActiveRuns((currentRuns) => ({ ...currentRuns, [session.id]: true }));
      try {
        const started = await bridge.startAgent(session.id, agentConfig());
        setState((currentState) => ({
          ...currentState,
          sessions: currentState.sessions.map((item) => item.id === started.id ? started : item)
        }));
      } catch (err) {
        setActiveRuns((currentRuns) => ({ ...currentRuns, [session.id]: false }));
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
      const cancelled = await bridge.cancelAgent(selected);
      if (!cancelled) setActiveRuns((currentRuns) => ({ ...currentRuns, [selected]: false }));
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

  async function saveProviderConfig() {
    setError("");
    try {
      const parsed = JSON.parse(providerJSON) as ProviderCatalog;
      if (!parsed.providers) parsed.providers = {};
      const saved = await bridge.saveProviderCatalog(parsed);
      setCatalog(saved);
      setProviderJSON(JSON.stringify(saved, null, 2));
      setProviderDirty(false);
      if (!modelRef || !Object.entries(saved.providers || {}).some(([providerID, provider]) =>
        Object.keys(provider.models || {}).some((modelID) => providerID + "/" + modelID === modelRef)
      )) {
        setModelRef(saved.model || "");
      }
    } catch (err) {
      setError(String(err));
    }
  }

  function newTask() {
    setSelected("");
    setMessages([]);
    setGoal("");
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
          <div className="brand-mark"><Icon name="spark" size={17} /></div>
          <div className="brand-copy">
            <strong>LumenCortex</strong>
            <span>Desktop</span>
          </div>
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label={t.close}>
            <Icon name="close" />
          </button>
        </div>

        <button className="new-task-button" onClick={newTask} disabled={!state.workspace}>
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

        <div className="sidebar-section-title">
          <span>{t.sessions}</span>
          <span>{state.sessions.length}</span>
        </div>

        <div className="thread-list">
          {state.sessions.map((session) => {
            const isActive = Boolean(activeRuns[session.id]);
            return (
              <button
                key={session.id}
                className={`thread-item ${session.id === selected ? "selected" : ""}`}
                onClick={() => {
                  setSelected(session.id);
                  setSidebarOpen(false);
                }}
              >
                <span className={`thread-dot ${isActive ? "live" : session.status}`} />
                <span className="thread-copy">
                  <strong>{session.goal}</strong>
                  <small>{isActive ? t.running : statusLabel(session.status)} · {formatClock(session.updatedAt)}</small>
                </span>
              </button>
            );
          })}
          {!state.sessions.length && <div className="sidebar-empty">{t.noSessions}</div>}
        </div>

        <div className="sidebar-footer">
          <div className="runtime-line">
            <span className={`runtime-dot ${health ? "online" : ""}`} />
            <span>{health ? t.runtimeOnline : t.runtimeOffline}</span>
            {health?.version && <code>{health.version}</code>}
          </div>
          <button className="footer-button" onClick={switchLocale}>
            <Icon name="globe" size={14} />
            <span>{t.language}</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label={t.close} />}

      <section className={`workspace-shell ${inspectorOpen ? "with-inspector" : ""}`}>
        <main className="workspace-main">
          <header className="topbar">
            <div className="topbar-left">
              <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label={t.expandSidebar}>
                <Icon name="menu" />
              </button>
              <div className="title-stack">
                <strong>{current?.goal || (state.workspace ? basename(state.workspace) : "LumenCortex")}</strong>
                {state.workspace && (
                  <span>
                    {t.local}
                    {current?.model ? ` · ${current.model}` : ""}
                    {current ? ` · ${statusLabel(current.status)}` : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="topbar-actions">
              {current && running && (
                <button className="toolbar-button stop" onClick={cancelAgent} disabled={busy}>
                  <Icon name="stop" size={14} />
                  <span>{t.stop}</span>
                </button>
              )}
              {current && !running && (current.status === "created" || current.status === "interrupted") && (
                <button className="toolbar-button" onClick={() => startAgent()} disabled={busy}>
                  <Icon name="play" size={14} />
                  <span>{current.status === "interrupted" ? t.resume : t.start}</span>
                </button>
              )}
              <button
                className={`icon-button ${inspectorOpen ? "active" : ""}`}
                onClick={() => setInspectorOpen((open) => !open)}
                aria-label={t.inspector}
              >
                <Icon name="panel" />
              </button>
            </div>
          </header>

          {!state.workspace ? (
            <div className="center-state onboarding">
              <div className="hero-mark"><Icon name="spark" size={30} /></div>
              <h1>{t.openRepoTitle}</h1>
              <p>{t.openRepoBody}</p>
              <button className="primary-action" onClick={pickWorkspace}>
                <Icon name="folder" size={16} />
                {t.chooseFolder}
              </button>
            </div>
          ) : !current ? (
            <div className="center-state new-thread-state">
              <div className="hero-mark small"><Icon name="spark" size={24} /></div>
              <h1>{t.buildTitle}</h1>
              <p>{t.buildBody}</p>
            </div>
          ) : (
            <div className="thread-view">
              <div className="thread-content">
                <section className="task-intro">
                  <div className="task-icon"><Icon name="spark" size={16} /></div>
                  <div>
                    <span>{t.newTask}</span>
                    <h1>{current.goal}</h1>
                    <div className="task-meta">
                      <span className={`status-pill ${running ? "running" : current.status}`}>{statusLabel(current.status)}</span>
                      {current.provider && <span>{current.provider}</span>}
                      {current.model && <span>{current.model}</span>}
                    </div>
                  </div>
                </section>

                <section className="message-list">
                  {messages.map((message) => (
                    <article key={`${message.seq}-${message.role}`} className={`message-row ${roleClass(message.role)}`}>
                      <div className="message-avatar">{message.role === "assistant" ? "LC" : message.role === "tool" ? "⌘" : "•"}</div>
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
                    <div className="final-label"><Icon name="spark" size={14} /> {t.finalAnswer}</div>
                    <p>{current.final}</p>
                  </section>
                )}
              </div>
            </div>
          )}

          {state.workspace && (
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

        {inspectorOpen && (
          <aside className="inspector">
            <div className="inspector-head">
              <div className="inspector-tabs">
                <button className={inspectorTab === "activity" ? "active" : ""} onClick={() => setInspectorTab("activity")}>{t.activity}</button>
                <button className={inspectorTab === "run" ? "active" : ""} onClick={() => setInspectorTab("run")}>{t.run}</button>
                <button className={inspectorTab === "providers" ? "active" : ""} onClick={() => setInspectorTab("providers")}>{t.providers}</button>
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
                    <button className="provider-link-button" type="button" onClick={() => setInspectorTab("providers")}>
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

              {inspectorTab === "providers" && (
                <div className="provider-pane">
                  <div className="provider-pane-head">
                    <div>
                      <strong>{t.providerConfig}</strong>
                      <code>lumencortex.json</code>
                    </div>
                    <button
                      className="save-provider-button"
                      type="button"
                      disabled={!providerDirty}
                      onClick={saveProviderConfig}
                    >
                      {t.saveConfig}
                    </button>
                  </div>
                  <p>{t.providerConfigHint}</p>
                  <textarea
                    className="provider-editor"
                    value={providerJSON}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                      setProviderJSON(event.target.value);
                      setProviderDirty(true);
                    }}
                    spellCheck={false}
                  />
                  <div className="provider-model-list">
                    {configuredModels.map((item) => (
                      <button key={item.ref} type="button" onClick={() => setModelRef(item.ref)} className={item.ref === modelRef ? "selected" : ""}>
                        <span>{item.label}</span>
                        <code>{item.ref}</code>
                      </button>
                    ))}
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
