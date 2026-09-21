import { FormEvent, useEffect, useMemo, useState } from "react";
import { bridge, onRuntimeEvent } from "./lib/bridge";
import type { AgentConfig, Message, RuntimeEvent, Session, WorkspaceState } from "./types";

const MAX_VISIBLE_EVENTS = 160;
const MAX_VISIBLE_MESSAGES = 80;

function bytes(value = 0) {
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
  if (value < 1024 * 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + " MB";
  return (value / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

function normalizePayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { content: value };
    }
  }
  return {};
}

function messageText(message: Message) {
  const payload = normalizePayload(message.json);
  if (typeof payload.content === "string" && payload.content.trim()) {
    return payload.content;
  }
  if (Array.isArray(payload.tool_calls)) {
    const names = payload.tool_calls
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const call = item as Record<string, unknown>;
        return typeof call.name === "string" ? call.name : "";
      })
      .filter(Boolean);
    if (names.length) return "Tool calls: " + names.join(", ");
  }
  const raw = JSON.stringify(payload, null, 2);
  return raw === "{}" ? "(empty message)" : raw;
}

function sessionStatusClass(session: Session) {
  switch (session.status) {
    case "completed":
      return "status-dot completed";
    case "interrupted":
      return "status-dot interrupted";
    case "waiting_gate":
      return "status-dot waiting";
    default:
      return "status-dot";
  }
}

export default function App() {
  const [state, setState] = useState<WorkspaceState>({ workspace: "", sessions: [] });
  const [selected, setSelected] = useState("");
  const [goal, setGoal] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [command, setCommand] = useState("git status --short");
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [activeRuns, setActiveRuns] = useState<Record<string, boolean>>({});
  const [baseUrl, setBaseUrl] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [policy, setPolicy] = useState<"read-only" | "workspace" | "full">("workspace");
  const [maxSteps, setMaxSteps] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    bridge.state().then((next) => {
      setState(next);
      if (next.sessions.length) setSelected(next.sessions[0].id);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selected && state.sessions.length) setSelected(state.sessions[0].id);
  }, [state.sessions, selected]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    bridge.recentMessages(selected, MAX_VISIBLE_MESSAGES).then(setMessages).catch(() => undefined);
  }, [selected]);

  useEffect(() => {
    return onRuntimeEvent((event) => {
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
        (event.type === "session.complete" ||
          event.type === "session.interrupted" ||
          event.type === "tool.end" ||
          event.type === "workflow.transition")
      ) {
        bridge.recentMessages(selected, MAX_VISIBLE_MESSAGES).then(setMessages).catch(() => undefined);
      }
    });
  }, [selected]);

  const current = useMemo(
    () => state.sessions.find((session) => session.id === selected),
    [state.sessions, selected]
  );
  const running = selected ? Boolean(activeRuns[selected]) : false;

  async function refreshCurrent() {
    if (!selected) return;
    const [session, recent] = await Promise.all([
      bridge.getSession(selected),
      bridge.recentMessages(selected, MAX_VISIBLE_MESSAGES)
    ]);
    setMessages(recent);
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
    } catch (err) {
      setError(String(err));
    }
  }

  async function createSession(event: FormEvent) {
    event.preventDefault();
    if (!goal.trim()) return;
    setBusy(true);
    setError("");
    try {
      const session = await bridge.createSession(goal.trim());
      setState((currentState) => ({
        ...currentState,
        sessions: [session, ...currentState.sessions.filter((item) => item.id !== session.id)]
      }));
      setSelected(session.id);
      setMessages([]);
      setGoal("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  function agentConfig(): AgentConfig {
    return {
      provider: {
        baseUrl: baseUrl.trim() || undefined,
        endpoint: endpoint.trim() || undefined,
        apiKey: apiKey || undefined,
        model: model.trim() || undefined
      },
      policy,
      maxSteps,
      recentMessages: 12,
      maxToolCallsPerStep: 8
    };
  }

  async function startAgent() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const session = await bridge.startAgent(selected, agentConfig());
      setActiveRuns((currentRuns) => ({ ...currentRuns, [selected]: true }));
      setState((currentState) => ({
        ...currentState,
        sessions: currentState.sessions.map((item) => item.id === session.id ? session : item)
      }));
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
      if (!cancelled) {
        setActiveRuns((currentRuns) => ({ ...currentRuns, [selected]: false }));
        await refreshCurrent();
      }
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
      await refreshCurrent();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const health = state.health;
  const pressure = health && health.budget.softBytes > 0
    ? Math.min(100, (health.usedBytes / health.budget.softBytes) * 100)
    : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LC</div>
          <div>
            <strong>LumenCortex</strong>
            <span>Desktop</span>
          </div>
        </div>

        <button className="workspace" onClick={pickWorkspace}>
          <span className="workspace-icon">⌘</span>
          <span>
            <small>Workspace</small>
            <strong>{state.workspace ? basename(state.workspace) : "Open project"}</strong>
          </span>
        </button>

        <div className="section-label">
          <span>Sessions</span>
          <span>{state.sessions.length}</span>
        </div>
        <div className="session-list">
          {state.sessions.map((session) => (
            <button
              key={session.id}
              className={session.id === selected ? "session active" : "session"}
              onClick={() => setSelected(session.id)}
            >
              <span className={sessionStatusClass(session)} />
              <span className="session-copy">
                <strong>{session.goal}</strong>
                <small>{session.status} · {session.id.slice(-8)}</small>
              </span>
            </button>
          ))}
          {!state.sessions.length && <p className="empty">No sessions yet.</p>}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">GO AGENT HARNESS</span>
            <h1>{current?.goal || "Agent workspace"}</h1>
          </div>
          <div className="runtime-badge">
            <span className={health ? "pulse online" : "pulse"} />
            {health ? "Go runtime " + health.version : "Runtime offline"}
          </div>
        </header>

        {!state.workspace ? (
          <section className="welcome">
            <div className="welcome-orb">LC</div>
            <h2>Open a repository to start.</h2>
            <p>
              LumenCortex Desktop embeds the Go runtime directly. Sessions and messages are durable in
              SQLite, tool output is bounded, and active runs can be cancelled without leaving orphaned
              workers behind.
            </p>
            <button className="primary" onClick={pickWorkspace}>Open workspace</button>
          </section>
        ) : (
          <>
            <section className="composer-card">
              <form onSubmit={createSession} className="composer">
                <input
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="Describe a coding task…"
                />
                <button className="primary" disabled={busy || !goal.trim()}>New session</button>
              </form>
            </section>

            <div className="content-grid">
              <div className="left-stack">
                <section className="panel conversation">
                  <div className="panel-title">
                    <div>
                      <span className="eyebrow">DURABLE</span>
                      <h2>Session transcript</h2>
                    </div>
                    <span className="counter">{messages.length}/{MAX_VISIBLE_MESSAGES}</span>
                  </div>
                  <div className="message-stream">
                    {messages.map((message) => (
                      <article className={"message role-" + message.role} key={message.seq}>
                        <div className="message-meta">
                          <strong>{message.role}</strong>
                          <span>#{message.seq}</span>
                        </div>
                        <pre>{messageText(message)}</pre>
                      </article>
                    ))}
                    {!messages.length && (
                      <p className="empty">Create a session, then start or resume the agent.</p>
                    )}
                  </div>
                </section>

                <section className="panel activity compact">
                  <div className="panel-title">
                    <div>
                      <span className="eyebrow">LIVE</span>
                      <h2>Runtime activity</h2>
                    </div>
                    <span className="counter">{events.length}/{MAX_VISIBLE_EVENTS}</span>
                  </div>
                  <div className="event-stream">
                    {events.slice().reverse().map((event) => (
                      <article className="event" key={String(event.seq) + "-" + event.type}>
                        <span className="event-seq">#{event.seq}</span>
                        <div>
                          <strong>{event.type}</strong>
                          <small>{event.sessionId ? event.sessionId.slice(-8) : "runtime"}</small>
                        </div>
                        <code>{event.data ? JSON.stringify(event.data) : ""}</code>
                      </article>
                    ))}
                    {!events.length && <p className="empty">Tool calls and runtime events will appear here.</p>}
                  </div>
                </section>
              </div>

              <aside className="panel inspector">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">AGENT</span>
                    <h2>Run configuration</h2>
                  </div>
                  {current && <span className="session-state">{running ? "active" : current.status}</span>}
                </div>

                <div className="provider-form">
                  <label>
                    Model
                    <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="LCX_MODEL fallback" />
                  </label>
                  <label>
                    Base URL
                    <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="LCX_BASE_URL or OpenAI default" />
                  </label>
                  <label>
                    Exact endpoint
                    <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="Optional /chat/completions URL" />
                  </label>
                  <label>
                    API key
                    <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="LCX_API_KEY fallback" autoComplete="off" />
                  </label>
                  <div className="form-row">
                    <label>
                      Policy
                      <select value={policy} onChange={(event) => setPolicy(event.target.value as "read-only" | "workspace" | "full")}>
                        <option value="read-only">read-only</option>
                        <option value="workspace">workspace</option>
                        <option value="full">full</option>
                      </select>
                    </label>
                    <label>
                      Max steps
                      <input type="number" min={1} max={200} value={maxSteps} onChange={(event) => setMaxSteps(Math.max(1, Number(event.target.value) || 1))} />
                    </label>
                  </div>

                  {!running ? (
                    <button className="primary run-button" onClick={startAgent} disabled={busy || !selected}>
                      {current?.status === "interrupted" ? "Resume agent" : "Start agent"}
                    </button>
                  ) : (
                    <button className="danger run-button" onClick={cancelAgent} disabled={busy}>
                      Cancel agent
                    </button>
                  )}
                  <p className="hint compact-hint">
                    API keys are not stored in the workspace database. Empty fields fall back to LCX_* environment variables.
                  </p>
                </div>

                <div className="divider" />

                <div className="panel-subtitle">Runtime health</div>
                <dl className="metrics">
                  <div><dt>Working memory</dt><dd>{bytes(health?.usedBytes)}</dd></div>
                  <div><dt>Soft budget</dt><dd>{bytes(health?.budget.softBytes)}</dd></div>
                  <div><dt>Hard budget</dt><dd>{bytes(health?.budget.hardBytes)}</dd></div>
                  <div><dt>Max agents</dt><dd>{health?.budget.maxAgents ?? "—"}</dd></div>
                </dl>
                <div className="meter"><span style={{ width: pressure + "%" }} /></div>

                {current?.final && (
                  <>
                    <div className="divider" />
                    <div className="panel-subtitle">Last final response</div>
                    <p className="final-preview">{current.final}</p>
                  </>
                )}

                <div className="divider" />

                <form onSubmit={runShell} className="shell-form">
                  <label>Shell smoke test</label>
                  <textarea
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    rows={3}
                    disabled={!selected || running}
                  />
                  <button className="secondary" disabled={busy || !selected || running || !command.trim()}>
                    Run in session
                  </button>
                </form>
              </aside>
            </div>
          </>
        )}

        {error && <div className="error-toast">{error}</div>}
      </main>
    </div>
  );
}
