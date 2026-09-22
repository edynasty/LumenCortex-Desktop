import type { ChangeEvent, FormEvent, KeyboardEvent, Ref } from "react";
import { ArrowUp, Folder, Square } from "lucide-react";
import type { SessionRuntime } from "../../types";
import { DesktopSelect, type SelectOption } from "../primitives/Select";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";

type Props = {
  runtime: SessionRuntime;
  workspaceName: string;
  modelRef: string;
  models: SelectOption[];
  policyLabel: string;
  goal: string;
  running: boolean;
  busy: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  labels: {
    startAnother: string;
    composerHint: string;
    noModels: string;
    start: string;
    running: string;
    localRuntime: string;
    worktreeRuntime: string;
  };
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function ThreadComposer({
  runtime,
  workspaceName,
  modelRef,
  models,
  policyLabel,
  goal,
  running,
  busy,
  textareaRef,
  labels,
  onGoalChange,
  onModelChange,
  onCancel,
  onSubmit,
  onKeyDown,
}: Props) {
  return (
    <div className="composer-dock">
      <form className="composer" onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          value={goal}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onGoalChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`${labels.startAnother}…`}
          aria-label={labels.startAnother}
          rows={1}
        />
        <div className="composer-footer">
          <div className="composer-context">
            <span><Folder size={13} strokeWidth={1.7} aria-hidden /> {workspaceName}</span>
            <DesktopSelect
              ariaLabel="Model"
              value={modelRef}
              placeholder={labels.noModels}
              options={models}
              onChange={onModelChange}
              className="composer-model-trigger"
            />
            <span>{policyLabel}</span>
            <RuntimeIdentity
              runtime={runtime}
              localLabel={labels.localRuntime}
              worktreeLabel={labels.worktreeRuntime}
              compact
            />
          </div>
          <div className="composer-actions">
            <span className="composer-hint">{labels.composerHint}</span>
            {running ? (
              <button
                className="send-button stop"
                type="button"
                disabled={busy}
                aria-label={labels.running}
                onClick={onCancel}
              >
                <Square size={13} strokeWidth={1.9} aria-hidden />
              </button>
            ) : (
              <button className="send-button" disabled={busy || !goal.trim()} aria-label={labels.start}>
                <ArrowUp size={15} strokeWidth={1.9} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
