import { FormEvent, useEffect, useMemo, useState } from "react";
import { bridge, onRuntimeEvent } from "./lib/bridge";
import type { AgentResult, AgentRunRequest, RuntimeEvent, WorkspaceState } from "./types";

const MAX_VISIBLE_EVENTS = 200;

function bytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

export default function App() {
  const [state, setState] = useState<WorkspaceState>({ workspace: "", sessions: [] });
  const [selected, setSelected] = useState("");
  const [goal, setGoal] = useState("");
  const [command, setCommand] = useState("git status --short");
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [error, setError] = useState("");

  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [policy, setPolicy] = useState<"read-only" | "workspace" | "full">("workspace");
  const [lastAgentResult, setLastAgentResult] = useState<AgentResult | null>(null);

  useEffect(() => {
    bridge.state().then(setState).catch(() => undefined);
    return onRuntimeEvent((event) => {
      setEvents((current) => [...current, event].slice(-MAX_VISIBLE_EVENTS));
    });
  }, []);

  useEffect(() => {
    if (!selected && state.sessions.length) setSelected(state.sessions[0].id);
  }, [state.sessions, selected]);

  const current = useMemo(
    () => state.sessions.find((session) => session.id === selected),
    [state.sessions, selected]
  );

  async function refreshState() {
    const next = await bridge.state();
    setState(next);
  }

  async function pickWorkspace() {
    setError("");
    try {
      const next = await bridge.pickWorkspace();
      setState(next);
      setSelected(next.sessions[0]?.id || "");
      setEvents([]);
      setLastAgentResult(null);
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
      setGoal("");
      setLastAgentResult(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runAgent(event: FormEvent) {
    event.preventDefault();
    if (!selected || !model.trim() || agentRunning) return;
    setAgentRunning(true);
    setError("");
    setLastAgentResult(null);
    const request: AgentRunRequest = {
      sessionId: selected,
      endpoint: endpoint.trim() || undefined,
      apiKey: apiKey || undefined,
      model: model.trim(),
      policy,
      maxSteps: 24,
      recentMessages: 8,
      maxToolCalls: 8
    };
    try {
      const result = await bridge.runAgent(request);
      setLastAgentResult(result);
      await refreshState();
    } catch (err) {
      const message = String(err);
      if (!message.toLowerCase().includes("context canceled")) setError(message);
      await refreshState().catch(() => undefined);
    } finally {
      setAgentRunning(false);
    }
  }

  async function cancelAgent() {
    if (!selected || !agentRunning) return;
    setError("");
    try {
      await bridge.cancelAgent(selected);
    } catch (err) {
      setError(String(err));
    }
  }

  async function runShell(event: FormEvent) {
    event.preventDefault();
    if (!selected || !command.trim()) return;
    setBusy(true);
    setError("");
    try {
      await bridge.runShell(selected, command.trim());
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
              onClick={() => {
                setSelected(session.id);
                setLastAgentResult(null);
              }}
            >
              <span className={session.status === "running" ? "status-dot running" : "status-dot"} />
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
            <span className="eyebrow">BOUND MEMORY RUNTIME</span>
            <h1>{current?.goal || "Agent workspace"}</h1>
          </div>
          <div className="runtime-badge">
            <span className={health ? "pulse online" : "pulse"} />
            {health ? `Go runtime ${health.version}` : "Runtime offline"}
          </div>
        </header>

        {!state.workspace ? (
          <section className="welcome">
            <div className="welcome-orb">LC</div>
            <h2>Open a repository to start.</h2>
            <p>
              LumenCortex Desktop embeds the same Go runtime as the CLI. Session history stays on disk,
              runtime events stay bounded, and long tool output streams instead of accumulating in memory.
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
                  placeholder="Create a new coding session…"
                />
                <button className="primary" disabled={busy || !goal.trim()}>New session</button>
              </form>
            </section>

            <div className="content-grid">
              <section className="panel activity">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">LIVE</span>
                    <h2>Runtime activity</h2>
                  </div>
                  <span className="counter">{events.length}/{MAX_VISIBLE_EVENTS}</span>
                </div>
                <div className="event-stream">
                  {events.slice().reverse().map((event) => (
                    <article className="event" key={`${event.seq}-${event.type}`}>
                      <span className="event-seq">#{event.seq}</span>
                      <div>
                        <strong>{event.type}</strong>
                        <small>{event.sessionId ? event.sessionId.slice(-8) : "runtime"}</small>
                      </div>
                      <code>{event.data ? JSON.stringify(event.data) : ""}</code>
                    </article>
                  ))}
                  {!events.length && <p className="empty">Agent, tool and workflow events will appear here.</p>}
                </div>
              </section>

              <aside className="panel inspector">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">AGENT</span>
                    <h2>Embedded runner</h2>
                  </div>
                  <span className={agentRunning ? "agent-state active" : "agent-state"}>
                    {agentRunning ? "running" : current?.status || "idle"}
                  </span>
                </div>

                <form onSubmit={runAgent} className="agent-form">
                  <label>
                    <span>Endpoint</span>
                    <input
                      value={endpoint}
                      onChange={(event) => setEndpoint(event.target.value)}
                      placeholder="https://…/v1/chat/completions"
                      disabled={agentRunning}
                    />
                  </label>
                  <label>
                    <span>Model</span>
                    <input
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="model name"
                      disabled={agentRunning}
                    />
                  </label>
                  <label>
                    <span>API key</span>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="kept in memory only"
                      autoComplete="off"
                      disabled={agentRunning}
                    />
                  </label>
                  <label>
                    <span>Policy</span>
                    <select
                      value={policy}
                      onChange={(event) => setPolicy(event.target.value as typeof policy)}
                      disabled={agentRunning}
                    >
                      <option value="read-only">read-only</option>
                      <option value="workspace">workspace</option>
                      <option value="full">full (shell)</option>
                    </select>
                  </label>
                  <div className="agent-actions">
                    <button className="primary" disabled={!selected || !model.trim() || agentRunning}>
                      Run agent
                    </button>
                    <button type="button" className="danger" disabled={!agentRunning} onClick={cancelAgent}>
                      Cancel
                    </button>
                  </div>
                  <p className="hint inline-hint">
                    Credentials are not persisted by Desktop. Use full policy only when the agent must run shell verification.
                  </p>
                </form>

                {lastAgentResult && (
                  <div className="result-card">
                    <div>
                      <strong>{lastAgentResult.status}</strong>
                      <span>{lastAgentResult.usage.totalTokens} tokens · {lastAgentResult.usage.requests} requests</span>
                    </div>
                    {lastAgentResult.final && <p>{lastAgentResult.final}</p>}
                  </div>
                )}

                <div className="divider" />

                <div className="panel-subtitle">
                  <span className="eyebrow">RESOURCE</span>
                  <strong>Runtime health</strong>
                </div>
                <dl className="metrics">
                  <div><dt>Working memory</dt><dd>{bytes(health?.usedBytes)}</dd></div>
                  <div><dt>Soft budget</dt><dd>{bytes(health?.budget.softBytes)}</dd></div>
                  <div><dt>Hard budget</dt><dd>{bytes(health?.budget.hardBytes)}</dd></div>
                  <div><dt>Max agents</dt><dd>{health?.budget.maxAgents ?? "—"}</dd></div>
                </dl>
                <div className="meter"><span style={{ width: `${pressure}%` }} /></div>
                <p className="hint">The UI keeps only the latest {MAX_VISIBLE_EVENTS} transient events. Durable state remains in SQLite.</p>

                <div className="divider" />

                <form onSubmit={runShell} className="shell-form">
                  <label>Shell smoke test</label>
                  <textarea
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    rows={3}
                    disabled={!selected || agentRunning}
                  />
                  <button className="secondary" disabled={busy || agentRunning || !selected || !command.trim()}>
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
