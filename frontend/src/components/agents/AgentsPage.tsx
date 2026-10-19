import { useEffect, useMemo, useState } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEffort, AgentProfile } from "../../types";
import { AGENT_PROFILE_LIMITS, agentProfileName, duplicateAgentName, validateAgentDraft } from "../../app/agent-profiles";
import type { AgentProfilesController } from "../../app/hooks/useAgentProfiles";
import type { AgentPolicy } from "../../app/agent-config";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { AgentProfileEditor } from "./AgentProfileEditor";
import type { PickerOption } from "../composer/ComposerPickers";
import "./agents.css";

const EMPTY_PROFILE: AgentProfile = {
  id: "",
  name: "",
  description: "",
  base: "agent",
  instructions: "",
  builtin: false,
};

const EFFORT_LABEL: Record<AgentEffort, "effortNone" | "effortLow" | "effortMedium" | "effortHigh" | "effortMax" | "effortAuto"> = {
  none: "effortNone",
  low: "effortLow",
  medium: "effortMedium",
  high: "effortHigh",
  max: "effortMax",
  auto: "effortAuto",
};

type Props = {
  labels: AppCopy;
  agents: AgentProfilesController;
  models: PickerOption[];
  recentModelRefs: string[];
  effortOptions: string[];
  onOpenProviders: () => void;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sameDraft(a: AgentProfile, b: AgentProfile): boolean {
  return a.name === b.name && (a.description ?? "") === (b.description ?? "") && a.base === b.base
    && a.instructions === b.instructions && (a.modelRef ?? "") === (b.modelRef ?? "")
    && (a.effort ?? "") === (b.effort ?? "") && (a.policy ?? "") === (b.policy ?? "");
}

/**
 * Agents page: the profile catalog (built-ins first) and the editor for the selected profile.
 * Instructions are additional text after Core's default prompt, so the page says that explicitly
 * and never presents them as a replacement; the base decides the run semantics and is fixed for the
 * built-ins. A dirty editor guards every selection change with an inline confirm.
 */
export function AgentsPage({ labels, agents, models, recentModelRefs, effortOptions, onOpenProviders }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>("ask");
  const [draft, setDraft] = useState<AgentProfile>(() => ({ ...agents.profiles[0] }));
  const [baseline, setBaseline] = useState<AgentProfile>(() => ({ ...agents.profiles[0] }));
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = useMemo(() => !sameDraft(draft, baseline), [baseline, draft]);
  const builtin = Boolean(draft.builtin);
  const counter = Array.from(draft.instructions).length;

  // A save/delete elsewhere (another pane, a reset) refreshes an editor that has no local edits.
  useEffect(() => {
    if (dirty || creating || !selectedId) return;
    const current = agents.profiles.find((profile) => profile.id === selectedId);
    if (current && !sameDraft(current, baseline)) {
      setDraft({ ...current });
      setBaseline({ ...current });
    }
  }, [agents.profiles, baseline, creating, dirty, selectedId]);

  function load(profile: AgentProfile) {
    setSelectedId(profile.id);
    setDraft({ ...profile });
    setBaseline({ ...profile });
    setCreating(false);
    setPending(undefined);
    setDeleteConfirm(false);
    setError("");
  }

  function open(id: string | null) {
    if (id === null) {
      setSelectedId(null);
      setDraft({ ...EMPTY_PROFILE });
      setBaseline({ ...EMPTY_PROFILE });
      setCreating(true);
      setPending(undefined);
      setDeleteConfirm(false);
      setError("");
      return;
    }
    const profile = agents.profiles.find((item) => item.id === id);
    if (profile) load(profile);
  }

  function requestOpen(id: string | null) {
    if (dirty) {
      setPending(id);
      return;
    }
    open(id);
  }

  async function save() {
    const problem = validateAgentDraft(draft, agents.profiles, labels);
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
        modelRef: draft.modelRef?.trim() || undefined,
        effort: draft.effort || undefined,
        policy: draft.policy || undefined,
      });
      const saved = draft.id
        ? next.profiles.find((profile) => profile.id === draft.id)
        : next.profiles.find((profile) => profile.name === draft.name.trim());
      if (saved) load(saved);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    setSaving(true);
    try {
      const next = await agents.remove(draft.id);
      const fallback = next.profiles.find((profile) => profile.id === "agent") ?? next.profiles[0];
      if (fallback) load(fallback);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!draft.id) return;
    setSaving(true);
    try {
      const next = await agents.reset(draft.id);
      const current = next.profiles.find((profile) => profile.id === draft.id);
      if (current) load(current);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    setSaving(true);
    setError("");
    try {
      const name = duplicateAgentName(draft, agents.profiles, labels);
      const next = await agents.save({ ...draft, id: "", name, builtin: false });
      const copy = next.profiles.find((profile) => profile.name === name);
      if (copy) load(copy);
    } catch (failure) {
      setError(errorText(failure));
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
      </header>

      <div className="agents-layout">
        <ul className="agents-list" aria-label={labels.agentsSelectHint}>
          {agents.profiles.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                className={`agents-row ${!creating && profile.id === selectedId ? "is-selected" : ""}`}
                aria-current={!creating && profile.id === selectedId ? "true" : undefined}
                title={agentProfileName(profile, labels)}
                onClick={() => requestOpen(profile.id)}
              >
                <span className="agents-row-name">
                  <Icon name={profile.base === "ask" ? "discussion" : "agents"} size={14} />
                  <span>{agentProfileName(profile, labels)}</span>
                </span>
                {profile.builtin && <span className="agents-badge">{labels.agentsBuiltin}</span>}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={`agents-row is-add ${creating ? "is-selected" : ""}`}
              disabled={agents.profiles.length >= AGENT_PROFILE_LIMITS.total}
              title={agents.profiles.length >= AGENT_PROFILE_LIMITS.total ? labels.agentLimitReached : labels.agentsNew}
              onClick={() => requestOpen(null)}
            >
              <Icon name="plus" size={14} />
              <span>{labels.agentsNew}</span>
            </button>
          </li>
        </ul>

        <AgentProfileEditor
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
          onDiscard={() => { setDraft({ ...baseline }); setError(""); }}
          onDuplicate={() => void duplicate()}
          onReset={() => void reset()}
          onDeleteRequest={() => setDeleteConfirm(true)}
          onDeleteConfirm={() => void remove()}
          onDeleteCancel={() => setDeleteConfirm(false)}
          onPendingDiscard={() => { if (pending !== undefined) open(pending); }}
          onPendingStay={() => setPending(undefined)}
        />
      </div>
    </div>
  );
}
