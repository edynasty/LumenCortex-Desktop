import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode, Ref } from "react";
import type { SessionRuntime } from "../../types";
import { Icon } from "../primitives/Icon";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import { ModelPicker, type PickerOption } from "../composer/ComposerPickers";

type Props = {
  runtime: SessionRuntime;
  workspaceName: string;
  modelRef: string;
  models: PickerOption[];
  policyLabel: string;
  // The thread's delegation grant control; absent where a thread cannot hold one.
  delegationControl?: ReactNode;
  goal: string;
  running: boolean;
  busy: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  labels: {
    startAnother: string;
    composerHint: string;
    noModels: string;
    modelSearch: string;
    noModelMatches: string;
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

// The follow-up composer: one glass card docked at the thread's foot. The textarea is
// borderless; the control bar carries the workspace, model, policy, grant and runtime as
// compact chips, with the round send/stop control on the right edge.
export function ThreadComposer({
  runtime,
  workspaceName,
  modelRef,
  models,
  policyLabel,
  delegationControl,
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
      <form className={`composer ${running ? "is-running" : ""}`} onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          value={goal}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onGoalChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`${labels.startAnother}…`}
          aria-label={labels.startAnother}
          rows={1}
        />
        <div className="composer-bar" onClick={(event) => event.stopPropagation()}>
          <span className="chip is-static is-collapsible" title={workspaceName}>
            <Icon name="project" size={14} />
            <span className="chip-label">{workspaceName}</span>
          </span>
          <ModelPicker
            ariaLabel={labels.modelSearch}
            value={modelRef}
            options={models}
            placeholder={labels.noModels}
            searchLabel={labels.modelSearch}
            emptyLabel={labels.noModelMatches}
            disabled={running}
            onChange={onModelChange}
          />
          <span className="chip is-static is-collapsible" title={policyLabel}>
            <Icon name="permission" size={14} />
            <span className="chip-label">{policyLabel}</span>
          </span>
          {delegationControl}
          <span className="composer-runtime">
            <RuntimeIdentity
              runtime={runtime}
              localLabel={labels.localRuntime}
              worktreeLabel={labels.worktreeRuntime}
              compact
            />
          </span>
          <span className="composer-spacer" />
          <span className="composer-hint"><span className="composer-hint-text">{labels.composerHint}</span></span>
          {running ? (
            <button
              className="send-btn is-stop"
              type="button"
              disabled={busy}
              aria-label={labels.running}
              title={labels.running}
              onClick={onCancel}
            >
              <Icon name="stop" size={13} />
            </button>
          ) : (
            <button
              className="send-btn"
              type="submit"
              disabled={busy || !goal.trim()}
              aria-label={labels.start}
              title={labels.start}
            >
              <Icon name="send" size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
