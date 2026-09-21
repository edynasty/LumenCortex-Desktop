import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Code2,
  Menu,
  PanelRight,
  Square,
  X
} from "lucide-react";
import { AppShell } from "./components/app-shell/AppShell";
import { NewTaskComposer } from "./components/composer/NewTaskComposer";
import { Inspector, type InspectorTab } from "./components/inspector/Inspector";
import { ProviderSettingsPanel } from "./components/provider/ProviderSettingsPanel";
import { Sidebar, type SidebarGroup } from "./components/sidebar/Sidebar";
import { ThreadWorkspace } from "./components/thread/ThreadWorkspace";
import { bridge, onRuntimeEvent } from "./lib/bridge";
import type { AgentConfig, Message, ProviderCatalog, RuntimeEvent, Session, WorkspaceState } from "./types";

const MAX_VISIBLE_EVENTS = 180;
const MAX_VISIBLE_MESSAGES = 100;

type Locale = "zh-CN" | "en";
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

  async function submitTask(event: FormEvent<HTMLFormElement>) {
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
      selectedSessionId={workspaceView === "workspace" ? selected : ""}
      providerActive={workspaceView === "providers"}
      runtimeState={runtimeState}
      runtimeVersion={health?.version}
      labels={{
        close: t.close,
        newTask: t.newTask,
        project: t.project,
        openProject: t.openProject,
        sessions: t.sessions,
        noSessions: t.noSessions,
        providerSettings: t.providerSettings,
        language: t.language,
        runtimeReady: t.runtimeReady,
        runtimeOnline: t.runtimeOnline,
        runtimeOffline: t.runtimeOffline
      }}
      onClose={() => setSidebarOpen(false)}
      onNewTask={newTask}
      onPickWorkspace={pickWorkspace}
      onSelectSession={(sessionId) => {
        setSelected(sessionId);
        setWorkspaceView("workspace");
        setSidebarOpen(false);
      }}
      onOpenProviders={() => {
        setWorkspaceView("providers");
        setInspectorOpen(false);
        setSidebarOpen(false);
      }}
      onSwitchLocale={switchLocale}
    />
  );

  const inspector = workspaceView === "workspace" ? (
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
        setWorkspaceView("providers");
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
        inspectorOpen={inspectorOpen && workspaceView === "workspace"}
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
              roleSystem: t.messageRoleSystem
            }}
            onGoalChange={setGoal}
            onModelChange={setModelRef}
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
