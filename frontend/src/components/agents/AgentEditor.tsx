import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentDelegation, AgentEffort, AgentEntry, AgentModelItem, AgentPolicy, AgentUse } from "../../types";
import { AGENT_LIMITS, agentName, utf8Bytes } from "../../app/agent-catalog";
import { effortChoicesFor, type EffortChoice } from "../../app/model-selection";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { MenuPicker } from "../composer/MenuPicker";
import type { PickerOption } from "../composer/ComposerPickers";
import { AgentModelList, type AgentModelOption } from "./AgentModelList";
import { effortMenuOptions } from "./agent-effort";
import "./agents.css";

export type AgentEditorProps = {
  labels: AppCopy;
  draft: AgentEntry;
  creating: boolean;
  dirty: boolean;
  saving: boolean;
  error: string;
  deleteConfirm: boolean;
  pending: string | null | undefined;
  models: AgentModelOption[];
  recentModelRefs: string[];
  effortOptions: string[];
  onOpenProviders: () => void;
  onChange: (next: AgentEntry) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDuplicate: () => void;
  onReset: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onPendingDiscard: () => void;
  onPendingStay: () => void;
};

/**
 * The selected agent's form. A built-in keeps its name, description, use and ceilings (Core refuses
 * to change them); instructions, effort and the ordered model list are editable on every agent. A
 * workspace definition is read-only here: this page writes the global lumincortex.json.
 */
export function AgentEditor({
  labels, draft, creating, dirty, saving, error, deleteConfirm, pending, models, recentModelRefs, effortOptions,
  onOpenProviders, onChange, onSave, onDiscard, onDuplicate, onReset,
  onDeleteRequest, onDeleteConfirm, onDeleteCancel, onPendingDiscard, onPendingStay,
}: AgentEditorProps) {
  const builtin = Boolean(draft.builtin);
  const locked = builtin || !draft.editable;
  // Instructions, effort and the model list stay editable on a built-in; only a workspace definition is read-only.
  const readOnly = !draft.editable;
  const counter = utf8Bytes(draft.instructions);
  const candidates = draft.models ?? [];
  // Each effort menu follows the models that may actually run, not the composer's current pick: a
  // candidate row lists the levels its own model declares, and the agent's default effort lists
  // their union, naming the candidates that would clamp a level their model does not accept
  // (Core's ClampEffort). Without candidates the agent inherits the run's model, so the composer's
  // levels are the best available signal.
  const candidateEfforts = candidates.map(
    (candidate) => models.find((option) => option.value === candidate.model)?.efforts,
  );
  const defaultChoices: EffortChoice[] = candidates.length
    ? effortChoicesFor(candidateEfforts, draft.effort)
    : effortOptions.map((level) => ({ level: level as AgentEffort, clampedFor: [] }));

  const effortChoices = effortMenuOptions(defaultChoices, candidateEfforts, labels);
  const policyChoices: PickerOption[] = [
    { value: "read-only", label: labels.readOnly, description: labels.readOnlyDescription },
    { value: "workspace", label: labels.workspace, description: labels.workspaceDescription },
    { value: "full", label: labels.full, description: labels.fullDescription },
  ].filter((choice) => draft.use === "conversation" || choice.value !== "full");
  const delegationChoices: PickerOption[] = [
    { value: "none", label: labels.delegationNone, description: labels.delegationNoneDescription },
    { value: "propose", label: labels.delegationPropose, description: labels.delegationProposeDescription },
    { value: "isolated", label: labels.delegationIsolated, description: labels.delegationIsolatedDescription },
  ];
  const title = creating ? labels.agentsNew : agentName(draft, labels);
  // Core clears the delegation of every non-conversation agent: it never delegates further.
  const delegationFixed = draft.use !== "conversation";

  function setModels(next: AgentModelItem[]) {
    onChange({ ...draft, models: next.length ? next : null });
  }

  function move(index: number, delta: number) {
    const next = [...candidates];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setModels(next);
  }

  return (
    <section className="agents-editor" aria-label={title}>
      <div className="agents-editor-head">
        <div className="agents-editor-title">
          <strong>{title}</strong>
          {dirty && <span className="agents-dirty">{labels.agentsUnsaved}</span>}
        </div>
        <div className="agents-editor-actions">
          <Button size="sm" variant="ghost" disabled={saving || creating || !draft.editable} onClick={onDuplicate}>
            <Icon name="copy" size={13} />{labels.agentsDuplicate}
          </Button>
          {builtin ? (
            <Button size="sm" variant="ghost" disabled={saving || !draft.editable} title={labels.agentsResetHint} onClick={onReset}>
              <Icon name="refresh" size={13} />{labels.agentsReset}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="is-danger"
              disabled={saving || creating || !draft.editable}
              onClick={onDeleteRequest}
            >
              <Icon name="delete" size={13} />{labels.agentsDelete}
            </Button>
          )}
        </div>
      </div>

      {!draft.editable && <p className="agents-note agents-locked">{labels.agentsWorkspaceLocked}</p>}

      {deleteConfirm && (
        <div className="agents-inline-confirm" role="alert">
          <span>{labels.agentsDeleteBody}</span>
          <Button size="sm" variant="danger" disabled={saving} onClick={onDeleteConfirm}>{labels.agentsDeleteConfirm}</Button>
          <Button size="sm" variant="ghost" onClick={onDeleteCancel}>{labels.agentsDeleteCancel}</Button>
        </div>
      )}

      {pending !== undefined && (
        <div className="agents-inline-confirm" role="alert">
          <span><strong>{labels.agentsDirtyTitle}</strong> {labels.agentsDirtyBody}</span>
          <Button size="sm" variant="primary" onClick={onPendingDiscard}>{labels.agentsDirtyDiscard}</Button>
          <Button size="sm" variant="ghost" onClick={onPendingStay}>{labels.agentsDirtyStay}</Button>
        </div>
      )}

      <label className="field">
        <span className="field-label">{labels.agentsName}</span>
        <input
          className="input"
          value={builtin ? agentName(draft, labels) : draft.name}
          disabled={locked}
          placeholder={labels.agentsNamePlaceholder}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field-label">{labels.agentsDescription}</span>
        <input
          className="input"
          value={draft.description ?? ""}
          disabled={locked}
          placeholder={labels.agentsDescriptionPlaceholder}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </label>

      <div className="field">
        <span className="field-label">{labels.agentsUse}</span>
        <SegmentedControl
          ariaLabel={labels.agentsUse}
          value={draft.use}
          options={[
            { value: "conversation", label: labels.agentsUseConversation, title: labels.agentsUseConversationDescription, disabled: locked },
            { value: "delegation", label: labels.agentsUseDelegation, title: labels.agentsUseDelegationDescription, disabled: locked },
            { value: "both", label: labels.agentsUseBoth, title: labels.agentsUseBothDescription, disabled: locked },
          ]}
          onChange={(use) => onChange({
            ...draft,
            use: use as AgentUse,
            delegation: use === "conversation" ? draft.delegation : "none",
            // A delegated agent caps its policy at read-only or workspace; full is not offered.
            policy: use !== "conversation" && draft.policy === "full" ? "workspace" : draft.policy,
          })}
        />
        <small className="agents-note">
          {builtin ? labels.agentsUseFixed : labels.agentsUseConversationDescription}
        </small>
      </div>

      <div className="agents-ceilings">
        <div className="field">
          <span className="field-label">{labels.agentsPolicy}</span>
          <MenuPicker
            ariaLabel={labels.agentsPolicy}
            value={draft.policy}
            placeholder={labels.full}
            disabled={locked}
            options={policyChoices}
            onChange={(policy) => onChange({ ...draft, policy: policy as AgentPolicy })}
          />
        </div>
        <div className="field">
          <span className="field-label">{labels.agentsDelegation}</span>
          <MenuPicker
            ariaLabel={labels.agentsDelegation}
            value={delegationFixed ? "none" : draft.delegation}
            placeholder={labels.delegationIsolated}
            disabled={locked || delegationFixed}
            disabledReason={delegationFixed ? labels.agentsDelegationFixed : undefined}
            options={delegationChoices}
            onChange={(delegation) => onChange({ ...draft, delegation: delegation as AgentDelegation })}
          />
        </div>
        <div className="field">
          <span className="field-label">{labels.agentsDefaultEffort}</span>
          <MenuPicker
            ariaLabel={labels.agentsDefaultEffort}
            value={draft.effort ?? ""}
            placeholder={labels.effortDefault}
            disabled={readOnly}
            options={effortChoices}
            onChange={(effort) => onChange({ ...draft, effort: (effort || undefined) as AgentEffort | undefined })}
          />
        </div>
      </div>

      <label className="field">
        <span className="field-label">
          {labels.agentsInstructions}
          <span className={`agents-counter ${counter > AGENT_LIMITS.instructions ? "is-over" : ""}`}>
            {counter}/{AGENT_LIMITS.instructions}
          </span>
        </span>
        <textarea
          className="input agents-instructions"
          value={draft.instructions}
          disabled={readOnly}
          placeholder={labels.agentsInstructionsPlaceholder}
          onChange={(event) => onChange({ ...draft, instructions: event.target.value })}
        />
        <small className="agents-note">{labels.agentsInstructionsNote}</small>
      </label>

      <AgentModelList
        labels={labels}
        models={models}
        recentModelRefs={recentModelRefs}
        candidates={candidates}
        efforts={candidateEfforts}
        readOnly={readOnly}
        onChange={(next) => onChange({ ...draft, models: next.length ? next : null })}
        onOpenProviders={onOpenProviders}
      />

      {error && <p className="agents-error" role="alert"><Icon name="failed" size={13} /><span>{error}</span></p>}

      <footer className="agents-editor-foot">
        <Button variant="primary" size="sm" disabled={(!dirty && !creating) || saving || !draft.editable} onClick={onSave}>
          {saving ? labels.agentsSaving : labels.agentsSave}
        </Button>
        <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={onDiscard}>
          {labels.agentsDiscard}
        </Button>
      </footer>
    </section>
  );
}
