import { useEffect, useMemo, useState } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEntry } from "../../types";
import { coreErrorKey } from "../../lib/core-errors";
import {
  AGENT_LIMITS, agentName, copyAgentName, emptyAgent, pendingAgentImportNotice, sameAgentDraft, validateAgentDraft,
} from "../../app/agent-catalog";
import type { AgentCatalogController } from "../../app/hooks/useAgentCatalog";
import { useAgentPresets } from "../../app/hooks/useAgentPresets";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { AgentEditor } from "./AgentEditor";
import type { AgentModelOption } from "./AgentModelList";
import { AgentPresetPicker } from "./AgentPresetPicker";
import "./agents.css";

type Props = {
  labels: AppCopy;
  agents: AgentCatalogController;
  models: AgentModelOption[];
  recentModelRefs: string[];
  effortOptions: string[];
  onOpenProviders: () => void;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function agentIcon(agent: AgentEntry): "discussion" | "agents" {
  return agent.policy === "read-only" ? "discussion" : "agents";
}

/**
 * Agents page: Core's merged catalog (the four built-ins first) and the editor for the selected
 * agent. Built-ins keep their name, description, use and ceilings; their instructions, effort and
 * models are editable. A workspace definition is shown read-only, because this page writes the
 * global file. A dirty editor guards every selection change with an inline confirm, and the result
 * of the one-time agents.json import is reported here rather than dropped.
 */
export function AgentsPage({ labels, agents, models, recentModelRefs, effortOptions, onOpenProviders }: Props) {
  const first = agents.agents[0];
  const [selectedId, setSelectedId] = useState<string | null>(first?.id ?? null);
  const [draft, setDraft] = useState<AgentEntry>(() => first ?? emptyAgent());
  const [baseline, setBaseline] = useState<AgentEntry>(() => first ?? emptyAgent());
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = useMemo(() => !sameAgentDraft(draft, baseline), [baseline, draft]);
  const custom = agents.agents.filter((agent) => !agent.builtin).length;
  // One-time notice: only when the import changed something and the user has not dismissed it.
  const importNotice = pendingAgentImportNotice(agents.importResult);
  const [dismissing, setDismissing] = useState(false);

  async function dismissImport() {
    setDismissing(true);
    try {
      await agents.dismissImport();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setDismissing(false);
    }
  }

  const presets = useAgentPresets({
    loadPresets: agents.presets,
    agents: agents.agents,
    dirty,
    onDraft: (next) => {
      setSelectedId(null);
      setDraft(next);
      setBaseline(next);
      setCreating(true);
      setPending(undefined);
      setDeleteConfirm(false);
      setError("");
    },
    onDirty: () => setPending(null),
  });

  // A save or delete elsewhere (another pane, a reload) refreshes an editor that has no local edits.
  useEffect(() => {
    if (dirty || creating || !selectedId) return;
    const current = agents.agents.find((agent) => agent.id === selectedId);
    if (current && !sameAgentDraft(current, baseline)) {
      setDraft(current);
      setBaseline(current);
    }
  }, [agents.agents, baseline, creating, dirty, selectedId]);

  function load(agent: AgentEntry) {
    setSelectedId(agent.id);
    setDraft(agent);
    setBaseline(agent);
    setCreating(false);
    setPending(undefined);
    setDeleteConfirm(false);
    setError("");
  }

  function open(id: string | null) {
    if (id === null) {
      const fresh = emptyAgent();
      setSelectedId(null);
      setDraft(fresh);
      setBaseline(fresh);
      setCreating(true);
      setPending(undefined);
      setDeleteConfirm(false);
      setError("");
      return;
    }
    const agent = agents.agents.find((item) => item.id === id);
    if (agent) load(agent);
  }

  function requestOpen(id: string | null) {
    if (dirty) {
      setPending(id);
      return;
    }
    open(id);
  }

  // A conflict means the hook reloaded the catalog: the copy says so instead of the raw sentinel.
  function failureText(failure: unknown): string {
    const message = errorText(failure);
    return coreErrorKey(message) === "conflict" ? labels.errConflict : message;
  }

  async function save() {
    const problem = validateAgentDraft(draft, agents.agents, labels);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = await agents.save({
        ...draft,
        name: draft.name.trim(),
        description: draft.description?.trim(),
        instructions: draft.instructions,
        effort: draft.effort || undefined,
        models: draft.models?.length ? draft.models : null,
      });
      const saved = draft.id
        ? next.agents.find((agent) => agent.id === draft.id)
        : next.agents.find((agent) => !agent.builtin && agent.name === draft.name.trim());
      if (saved) load(saved);
      else setBaseline(draft);
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    setSaving(true);
    try {
      const next = await agents.remove(draft.id);
      const fallback = next.agents.find((agent) => agent.id === "agent") ?? next.agents[0];
      if (fallback) load(fallback);
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!draft.id) return;
    setSaving(true);
    try {
      // A built-in's override is removed by saving it empty; Core then has nothing to override.
      const next = await agents.save({
        ...draft, instructions: "", effort: undefined, models: null,
      });
      const current = next.agents.find((agent) => agent.id === draft.id);
      if (current) load(current);
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    setSaving(true);
    setError("");
    try {
      const name = copyAgentName(draft, agents.agents, labels);
      const next = await agents.save({
        ...draft, id: "", name, builtin: false, source: "global",
        instructions: draft.instructions, models: draft.models,
      });
      const copy = next.agents.find((agent) => !agent.builtin && agent.name === name);
      if (copy) load(copy);
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="agents-page">
      <header className="agents-head">
        <h2>{labels.agentsTitle}</h2>
        <p>{labels.agentsLede}</p>
        {agents.warning && (
          <p className="agents-warning" role="status">
            <Icon name="failed" size={13} />
            <span>{labels.agentsWarning}{agents.warning}</span>
          </p>
        )}
        {agents.loadError && (
          <p className="agents-warning" role="alert">
            <Icon name="failed" size={13} />
            <span>{labels.agentsWarning}{agents.loadError}</span>
          </p>
        )}
        {importNotice && (
          <section className="agents-import" aria-label={labels.agentsImportTitle}>
            <strong>{labels.agentsImportTitle}</strong>
            <p>
              {importNotice.imported
                ? labels.agentsImportBody.replace("{file}", importNotice.renamedTo ?? "agents.json.imported")
                : importNotice.alreadyImported
                  ? labels.agentsImportAlready.replace("{file}", importNotice.renamedTo ?? "agents.json.imported")
                  : labels.agentsImportNotImported}
            </p>
            {importNotice.skipped > 0 && (
              <p>{labels.agentsImportSkipped.replace("{count}", String(importNotice.skipped))}</p>
            )}
            {importNotice.warnings?.length ? (
              <>
                <p>{labels.agentsImportWarnings}</p>
                <ul>
                  {importNotice.warnings.map((line, index) => <li key={index}>{line}</li>)}
                </ul>
              </>
            ) : null}
            <Button size="sm" variant="ghost" disabled={dismissing} onClick={() => void dismissImport()}>
              {labels.agentsImportDismiss}
            </Button>
          </section>
        )}
      </header>

      {presets.open && (
        <AgentPresetPicker
          labels={labels}
          presets={presets.presets}
          loading={presets.loading}
          error={presets.error}
          onPick={presets.pick}
          onClose={presets.close}
        />
      )}

      <div className="agents-layout">
        <ul className="agents-list" aria-label={labels.agentsSelectHint}>
          {agents.agents.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                className={`agents-row ${!creating && agent.id === selectedId ? "is-selected" : ""}`}
                aria-current={!creating && agent.id === selectedId ? "true" : undefined}
                title={agentName(agent, labels)}
                onClick={() => requestOpen(agent.id)}
              >
                <span className="agents-row-name">
                  <Icon name={agentIcon(agent)} size={14} />
                  <span>{agentName(agent, labels)}</span>
                </span>
                {agent.builtin
                  ? <span className="agents-badge">{labels.agentsBuiltin}</span>
                  : agent.source === "workspace" && <span className="agents-badge">{labels.agentsSourceWorkspace}</span>}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={`agents-row is-add ${creating ? "is-selected" : ""}`}
              disabled={custom >= AGENT_LIMITS.maxCustom}
              title={custom >= AGENT_LIMITS.maxCustom ? labels.agentLimitReached : labels.agentsNew}
              onClick={() => requestOpen(null)}
            >
              <Icon name="plus" size={14} />
              <span>{labels.agentsNew}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`agents-row is-add ${presets.open ? "is-selected" : ""}`}
              disabled={custom >= AGENT_LIMITS.maxCustom}
              title={custom >= AGENT_LIMITS.maxCustom ? labels.agentLimitReached : labels.agentsPresetsOpen}
              aria-expanded={presets.open}
              onClick={() => void presets.toggle()}
            >
              <Icon name="preset" size={14} />
              <span>{labels.agentsPresetsOpen}</span>
            </button>
          </li>
        </ul>

        <AgentEditor
          labels={labels}
          draft={draft}
          creating={creating}
          dirty={dirty}
          saving={saving}
          error={error}
          deleteConfirm={deleteConfirm}
          pending={pending}
          models={models}
          recentModelRefs={recentModelRefs}
          effortOptions={effortOptions}
          onOpenProviders={onOpenProviders}
          onChange={setDraft}
          onSave={() => void save()}
          onDiscard={() => { setDraft(baseline); setError(""); }}
          onDuplicate={() => void duplicate()}
          onReset={() => void reset()}
          onDeleteRequest={() => setDeleteConfirm(true)}
          onDeleteConfirm={() => void remove()}
          onDeleteCancel={() => setDeleteConfirm(false)}
          onPendingDiscard={() => {
            if (presets.hasPending) presets.discardPending();
            else if (pending !== undefined) open(pending);
          }}
          onPendingStay={() => { presets.keepEditing(); setPending(undefined); }}
        />
      </div>
    </div>
  );
}
