import { FormEvent } from "react";
import { Icon } from "./Icon";
import type { Copy } from "../i18n";
import type { Health, RuntimeEvent, Session } from "../types";
import { bytes, eventSummary, formatClock, statusText } from "../ui-utils";

type Props = {
  copy: Copy;
  current?: Session;
  currentEvents: RuntimeEvent[];
  health?: Health;
  model: string;
  baseUrl: string;
  endpoint: string;
  apiKey: string;
  policy: "read-only" | "workspace" | "full";
  maxSteps: number;
  command: string;
  pressure: number;
  running: boolean;
  busy: boolean;
  open: boolean;
  tab: "activity" | "config";
  onTab: (tab: "activity" | "config") => void;
  onClose: () => void;
  onModel: (value: string) => void;
  onBaseUrl: (value: string) => void;
  onEndpoint: (value: string) => void;
  onApiKey: (value: string) => void;
  onPolicy: (value: "read-only" | "workspace" | "full") => void;
  onMaxSteps: (value: number) => void;
  onCommand: (value: string) => void;
  onRunShell: (event: FormEvent) => void;
  onStart: () => void;
  onStop: () => void;
};

export function Inspector({
  copy,
  current,
  currentEvents,
  health,
  model,
  baseUrl,
  endpoint,
  apiKey,
  policy,
  maxSteps,
  command,
  pressure,
  running,
  busy,
  open,
  tab,
  onTab,
  onClose,
  onModel,
  onBaseUrl,
  onEndpoint,
  onApiKey,
  onPolicy,
  onMaxSteps,
  onCommand,
  onRunShell,
  onStart,
  onStop,
}: Props) {
  return (
    <>
      <aside className={open ? "inspector open" : "inspector"}>
        <div className="inspector-header">
          <div className="inspector-tabs">
            <button className={tab === "activity" ? "active" : ""} onClick={() => onTab("activity")}>
              {copy.activity}
            </button>
            <button className={tab === "config" ? "active" : ""} onClick={() => onTab("config")}>
              {copy.config}
            </button>
          </div>
          <button className="icon-button close-inspector" onClick={onClose} aria-label={copy.hidePanel}>×</button>
        </div>

        {tab === "activity" ? (
          <div className="inspector-scroll">
            <section className="inspector-section">
              <div className="section-title-row">
                <h3>{copy.activity}</h3>
                {running && <span className="live-pill"><i />{copy.live}</span>}
              </div>
              <div className="activity-list">
                {currentEvents.map((event) => (
                  <div className="activity-item" key={event.seq}>
                    <span className={"activity-dot " + event.type.replaceAll(".", "-")} />
                    <div>
                      <strong>{event.type}</strong>
                      <small>
                        {formatClock(event.at)}
                        {eventSummary(event) ? " · " + eventSummary(event) : ""}
                      </small>
                    </div>
                  </div>
                ))}
                {!currentEvents.length && <p className="muted">{copy.noActivity}</p>}
              </div>
            </section>

            {current && (
              <section className="inspector-section">
                <h3>{copy.status}</h3>
                <dl className="key-values">
                  <div><dt>{copy.status}</dt><dd>{statusText(copy, running ? "running" : current.status)}</dd></div>
                  <div><dt>{copy.sessionId}</dt><dd title={current.id}>{current.id.slice(-10)}</dd></div>
                  <div><dt>{copy.provider}</dt><dd>{current.provider || "—"}</dd></div>
                  <div><dt>{copy.model}</dt><dd>{current.model || model || "—"}</dd></div>
                  <div><dt>{copy.tokens}</dt><dd>{current.usage?.totalTokens ?? "—"}</dd></div>
                </dl>
              </section>
            )}

            <section className="inspector-section">
              <h3>{copy.runtime}</h3>
              <div className="runtime-status">
                <span className={health ? "runtime-light online" : "runtime-light"} />
                <div>
                  <strong>{health ? copy.runtimeOnline : copy.runtimeOffline}</strong>
                  <small>{health?.version || "—"}</small>
                </div>
              </div>
              <dl className="key-values runtime-values">
                <div><dt>{copy.workingMemory}</dt><dd>{bytes(health?.usedBytes)}</dd></div>
                <div><dt>{copy.softBudget}</dt><dd>{bytes(health?.budget.softBytes)}</dd></div>
                <div><dt>{copy.hardBudget}</dt><dd>{bytes(health?.budget.hardBytes)}</dd></div>
                <div><dt>{copy.maxAgents}</dt><dd>{health?.budget.maxAgents ?? "—"}</dd></div>
              </dl>
              <div className="memory-meter"><span style={{ width: pressure + "%" }} /></div>
            </section>

            <section className="inspector-section">
              <div className="section-title-row">
                <h3>{copy.terminal}</h3>
                <Icon name="terminal" size={15} />
              </div>
              <form className="terminal-form" onSubmit={onRunShell}>
                <textarea
                  value={command}
                  onChange={(event) => onCommand(event.target.value)}
                  placeholder={copy.commandPlaceholder}
                  rows={3}
                  disabled={!current || running}
                />
                <button disabled={busy || !current || running || !command.trim()}>{copy.runCommand}</button>
              </form>
            </section>
          </div>
        ) : (
          <div className="inspector-scroll">
            <section className="inspector-section">
              <h3>{copy.config}</h3>
              <div className="config-form">
                <label>
                  <span>{copy.model}</span>
                  <input value={model} onChange={(event) => onModel(event.target.value)} placeholder="LCX_MODEL" />
                </label>
                <label>
                  <span>{copy.baseUrl}</span>
                  <input value={baseUrl} onChange={(event) => onBaseUrl(event.target.value)} placeholder="LCX_BASE_URL" />
                </label>
                <label>
                  <span>{copy.endpoint}</span>
                  <input value={endpoint} onChange={(event) => onEndpoint(event.target.value)} placeholder="/chat/completions" />
                </label>
                <label>
                  <span>{copy.apiKey}</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => onApiKey(event.target.value)}
                    placeholder="LCX_API_KEY"
                    autoComplete="off"
                  />
                </label>

                <div className="config-grid">
                  <label>
                    <span>{copy.permission}</span>
                    <select
                      value={policy}
                      onChange={(event) => onPolicy(event.target.value as "read-only" | "workspace" | "full")}
                    >
                      <option value="read-only">{copy.readonly}</option>
                      <option value="workspace">{copy.workspacePermission}</option>
                      <option value="full">{copy.fullPermission}</option>
                    </select>
                  </label>
                  <label>
                    <span>{copy.maxSteps}</span>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={maxSteps}
                      onChange={(event) => onMaxSteps(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </label>
                </div>

                <p className="config-hint">{copy.envFallback}</p>

                {current && (
                  running ? (
                    <button className="config-stop" onClick={onStop} disabled={busy}>
                      <Icon name="stop" size={14} /> {copy.stop}
                    </button>
                  ) : (
                    <button className="config-run" onClick={onStart} disabled={busy}>
                      <Icon name="play" size={14} /> {current.status === "interrupted" ? copy.resume : copy.run}
                    </button>
                  )
                )}
              </div>
            </section>
          </div>
        )}
      </aside>

      {open && (
        <button
          className="mobile-backdrop inspector-backdrop"
          onClick={onClose}
          aria-label={copy.hidePanel}
        />
      )}
    </>
  );
}
