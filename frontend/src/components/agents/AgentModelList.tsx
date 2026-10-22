import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEffort, AgentModelItem } from "../../types";
import { AGENT_LIMITS } from "../../app/agent-catalog";
import { effortChoicesFor } from "../../app/model-selection";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { MenuPicker } from "../composer/MenuPicker";
import { ModelPicker, type PickerOption } from "../composer/ComposerPickers";
import { effortMenuOptions } from "./agent-effort";

/** A model row of the catalog with the effort levels it declares, which the effort menus follow. */
export type AgentModelOption = PickerOption & { efforts?: string[] };

type Props = {
  labels: AppCopy;
  models: AgentModelOption[];
  recentModelRefs: string[];
  candidates: AgentModelItem[];
  /** Each candidate's model effort levels, in the same order as `candidates`. */
  efforts: (string[] | undefined)[];
  readOnly: boolean;
  onChange: (next: AgentModelItem[]) => void;
  onOpenProviders: () => void;
};

/**
 * An agent's ordered model candidates. Each row's effort menu offers only what that row's model
 * declares; the order is Core's failover order, so the first model must call tools.
 */
export function AgentModelList({
  labels, models, recentModelRefs, candidates, efforts, readOnly, onChange, onOpenProviders,
}: Props) {
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= candidates.length) return;
    const next = [...candidates];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="field">
      <span className="field-label">
        {labels.agentsModels}
        <span className="agents-counter">{candidates.length}/{AGENT_LIMITS.models}</span>
      </span>
      {candidates.length === 0 && <small className="agents-note">{labels.agentsModelsInherit}</small>}
      <ol className="agents-models" aria-label={labels.agentsModels}>
        {candidates.map((candidate, index) => (
          <li className="agents-model-row" key={`${candidate.model}-${index}`}>
            <span className="agents-model-index" aria-hidden>{index + 1}</span>
            <ModelPicker
              ariaLabel={`${labels.agentsModels} ${index + 1}`}
              value={candidate.model}
              options={models}
              placeholder={labels.noModels}
              searchLabel={labels.modelSearch}
              emptyLabel={labels.noModelMatches}
              recentLabel={labels.recentModels}
              recentRefs={recentModelRefs}
              disabled={readOnly}
              onChange={(model) => {
                const next = [...candidates];
                next[index] = { ...next[index], model };
                onChange(next);
              }}
              footer={{ label: labels.providerSettings, onSelect: onOpenProviders }}
            />
            <MenuPicker
              ariaLabel={`${labels.agentsModelEffort} ${index + 1}`}
              value={candidate.effort ?? ""}
              placeholder={labels.effortDefault}
              disabled={readOnly}
              options={effortMenuOptions(
                effortChoicesFor([efforts[index]], candidate.effort as AgentEffort | undefined),
                [efforts[index]],
                labels,
              )}
              onChange={(effort) => {
                const next = [...candidates];
                next[index] = { ...next[index], effort: (effort || undefined) as AgentEffort | undefined };
                onChange(next);
              }}
            />
            <div className="agents-model-actions">
              <button
                type="button"
                className="agents-model-btn"
                aria-label={`${labels.agentsModelUp} ${index + 1}`}
                title={labels.agentsModelUp}
                disabled={readOnly || index === 0}
                onClick={() => move(index, -1)}
              >
                <Icon name="moveUp" size={13} />
              </button>
              <button
                type="button"
                className="agents-model-btn"
                aria-label={`${labels.agentsModelDown} ${index + 1}`}
                title={labels.agentsModelDown}
                disabled={readOnly || index === candidates.length - 1}
                onClick={() => move(index, 1)}
              >
                <Icon name="moveDown" size={13} />
              </button>
              <button
                type="button"
                className="agents-model-btn is-danger"
                aria-label={`${labels.agentsModelRemove} ${index + 1}`}
                title={labels.agentsModelRemove}
                disabled={readOnly}
                onClick={() => onChange(candidates.filter((_, at) => at !== index))}
              >
                <Icon name="delete" size={13} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="agents-models-foot">
        <Button
          size="sm"
          variant="ghost"
          disabled={readOnly || candidates.length >= AGENT_LIMITS.models}
          title={candidates.length >= AGENT_LIMITS.models ? labels.agentsModelsLimit : labels.agentsModelAdd}
          onClick={() => onChange([...candidates, { model: models[0]?.value ?? "" }])}
        >
          <Icon name="plus" size={13} />{labels.agentsModelAdd}
        </Button>
        <small className="agents-note">{labels.agentsModelsHint}</small>
      </div>
    </div>
  );
}
