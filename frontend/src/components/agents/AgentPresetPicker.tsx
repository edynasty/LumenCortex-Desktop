import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEntry } from "../../types";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import "./agents.css";

type Props = {
  labels: AppCopy;
  /** null until the presets have been read; [] means Core has none. */
  presets: AgentEntry[] | null;
  loading: boolean;
  error: string;
  onPick: (preset: AgentEntry) => void;
  onClose: () => void;
};

/**
 * The compiled-in specialists (ADR-0009 A4). Picking one opens an unsaved draft in the editor; the
 * preset itself is never added to the catalog until the user saves the draft. A preset whose model
 * list came from an oh-my-pi model role says so, so the source of the models is visible.
 */
export function AgentPresetPicker({ labels, presets, loading, error, onPick, onClose }: Props) {
  return (
    <section className="agents-presets" aria-label={labels.agentsPresetsTitle}>
      <header className="agents-presets-head">
        <strong>{labels.agentsPresetsTitle}</strong>
        <Button size="sm" variant="ghost" onClick={onClose}>{labels.agentsPresetsClose}</Button>
      </header>
      <p className="agents-note">{labels.agentsPresetsHint}</p>
      {loading && <p className="agents-note" role="status">{labels.agentsPresetsLoading}</p>}
      {error && (
        <p className="agents-warning" role="alert">
          <Icon name="failed" size={13} />
          <span>{error}</span>
        </p>
      )}
      {!loading && !error && presets?.length === 0 && <p className="agents-note">{labels.agentsPresetsEmpty}</p>}
      {presets && presets.length > 0 && (
        <ul className="agents-presets-list">
          {presets.map((preset) => (
            <li key={preset.id}>
              <button type="button" className="agents-preset" onClick={() => onPick(preset)}>
                <span className="agents-preset-name">
                  <Icon name="preset" size={14} />
                  <strong>{preset.name}</strong>
                </span>
                <span className="agents-preset-desc">{preset.description}</span>
                {preset.ompRole && preset.models?.length ? (
                  <span className="agents-preset-note">
                    {labels.agentsPresetsModelsFromRole.replace("{role}", preset.ompRole)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
