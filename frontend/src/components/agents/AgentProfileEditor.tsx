import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEffort, AgentProfile } from "../../types";
import { AGENT_PROFILE_LIMITS, agentProfileName } from "../../app/agent-profiles";
import type { AgentPolicy } from "../../app/agent-config";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { MenuPicker } from "../composer/MenuPicker";
import { ModelPicker, type PickerOption } from "../composer/ComposerPickers";
import "./agents.css";

const EFFORT_LABEL: Record<AgentEffort, "effortNone" | "effortLow" | "effortMedium" | "effortHigh" | "effortMax" | "effortAuto"> = {
  none: "effortNone",
  low: "effortLow",
  medium: "effortMedium",
  high: "effortHigh",
  max: "effortMax",
  auto: "effortAuto",
};

export type AgentEditorProps = {
  labels: AppCopy;
  draft: AgentProfile;
  creating: boolean;
  dirty: boolean;
  saving: boolean;
  error: string;
  deleteConfirm: boolean;
  pending: string | null | undefined;
  models: PickerOption[];
  recentModelRefs: string[];
  effortOptions: string[];
  onOpenProviders: () => void;
  onChange: (next: AgentProfile) => void;
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

/** The selected profile's form. Every change goes through onChange; the page owns saving and guards. */
export function AgentProfileEditor({
  labels, draft, creating, dirty, saving, error, deleteConfirm, pending, models, recentModelRefs, effortOptions,
  onOpenProviders, onChange, onSave, onDiscard, onDuplicate, onReset,
  onDeleteRequest, onDeleteConfirm, onDeleteCancel, onPendingDiscard, onPendingStay,
}: AgentEditorProps) {
  const builtin = Boolean(draft.builtin);
  const counter = Array.from(draft.instructions).length;
  const effortChoices: PickerOption[] = [
    { value: "", label: labels.effortDefault },
    ...effortOptions.map((level) => ({ value: level, label: labels[EFFORT_LABEL[level as AgentEffort]] })),
  ];
  const policyOptions: PickerOption[] = [
    { value: "read-only", label: labels.readOnly, description: labels.readOnlyDescription },
    { value: "workspace", label: labels.workspace, description: labels.workspaceDescription },
    { value: "full", label: labels.full, description: labels.fullDescription },
  ];
  const modelChoices: PickerOption[] = [{ value: "", label: labels.agentsModelNone }, ...models];
  const title = creating ? labels.agentsNew : agentProfileName(draft, labels);

  return (
    <section className="agents-editor" aria-label={title}>
      <div className="agents-editor-head">
        <div className="agents-editor-title">
          <strong>{title}</strong>
          {dirty && <span className="agents-dirty">{labels.agentsUnsaved}</span>}
        </div>
        <div className="agents-editor-actions">
          <Button size="sm" variant="ghost" disabled={saving || creating} onClick={onDuplicate}>
            <Icon name="copy" size={13} />{labels.agentsDuplicate}
          </Button>
          {builtin ? (
            <Button size="sm" variant="ghost" disabled={saving} title={labels.agentsResetHint} onClick={onReset}>
              <Icon name="refresh" size={13} />{labels.agentsReset}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="is-danger"
              disabled={saving || creating}
              onClick={onDeleteRequest}
            >
              <Icon name="delete" size={13} />{labels.agentsDelete}
            </Button>
          )}
        </div>
      </div>

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
          value={builtin ? agentProfileName(draft, labels) : draft.name}
          disabled={builtin}
          placeholder={labels.agentsNamePlaceholder}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field-label">{labels.agentsDescription}</span>
        <input
          className="input"
          value={draft.description ?? ""}
          placeholder={labels.agentsDescriptionPlaceholder}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </label>

      <div className="field">
        <span className="field-label">{labels.agentsBase}</span>
        <SegmentedControl
          ariaLabel={labels.agentsBase}
          value={draft.base}
          options={[
            { value: "ask", label: labels.agentsBaseAsk, title: labels.agentsBaseAskDescription, disabled: builtin },
            { value: "agent", label: labels.agentsBaseAgent, title: labels.agentsBaseAgentDescription, disabled: builtin },
          ]}
          onChange={(base) => onChange({ ...draft, base })}
        />
        <small className="agents-note">{builtin ? labels.agentsBaseFixed : labels.agentsBaseAskDescription}</small>
      </div>

      <label className="field">
        <span className="field-label">
          {labels.agentsInstructions}
          <span className={`agents-counter ${counter > AGENT_PROFILE_LIMITS.instructions ? "is-over" : ""}`}>
            {counter}/{AGENT_PROFILE_LIMITS.instructions}
          </span>
        </span>
        <textarea
          className="input agents-instructions"
          value={draft.instructions}
          placeholder={labels.agentsInstructionsPlaceholder}
          onChange={(event) => onChange({ ...draft, instructions: event.target.value })}
        />
        <small className="agents-note">{labels.agentsInstructionsNote}</small>
      </label>

      <div className="agents-defaults">
        <div className="field">
          <span className="field-label">{labels.agentsDefaultModel}</span>
          <ModelPicker
            ariaLabel={labels.agentsDefaultModel}
            value={draft.modelRef ?? ""}
            options={modelChoices}
            placeholder={labels.agentsModelNone}
            searchLabel={labels.modelSearch}
            emptyLabel={labels.noModelMatches}
            recentLabel={labels.recentModels}
            recentRefs={recentModelRefs}
            onChange={(modelRef) => onChange({ ...draft, modelRef })}
            footer={{ label: labels.providerSettings, onSelect: onOpenProviders }}
          />
          <small className="agents-note">{labels.agentsModelHint}</small>
        </div>
        <div className="field">
          <span className="field-label">{labels.agentsDefaultEffort}</span>
          <MenuPicker
            ariaLabel={labels.agentsDefaultEffort}
            value={draft.effort ?? ""}
            placeholder={labels.effortDefault}
            options={effortChoices}
            onChange={(effort) => onChange({ ...draft, effort: (effort || undefined) as AgentEffort | undefined })}
          />
        </div>
        <div className="field">
          <span className="field-label">{labels.agentsDefaultPolicy}</span>
          <MenuPicker
            ariaLabel={labels.agentsDefaultPolicy}
            value={draft.policy ?? ""}
            placeholder={labels.workspace}
            options={policyOptions}
            onChange={(policy) => onChange({ ...draft, policy: (policy || undefined) as AgentPolicy | undefined })}
          />
          {draft.base === "ask" && <small className="agents-note">{labels.agentsAskPolicyNote}</small>}
        </div>
      </div>

      {error && <p className="agents-error" role="alert"><Icon name="failed" size={13} /><span>{error}</span></p>}

      <footer className="agents-editor-foot">
        <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={onSave}>
          {saving ? labels.agentsSaving : labels.agentsSave}
        </Button>
        <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={onDiscard}>
          {labels.agentsDiscard}
        </Button>
      </footer>
    </section>
  );
}
