import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { ArrowUp, Folder, HardDrive, Settings2 } from "lucide-react";
import "./new-task-composer.css";

export type ComposerPolicy = "read-only" | "workspace" | "full";

type ModelOption = {
  ref: string;
  label: string;
};

type Props = {
  title: string;
  subtitle: string;
  placeholder: string;
  workspace: string;
  workspaceName: string;
  chooseProjectLabel: string;
  modelLabel: string;
  modelRef: string;
  models: ModelOption[];
  noModelsLabel: string;
  policy: ComposerPolicy;
  policyLabels: Record<ComposerPolicy, string>;
  localLabel: string;
  hint: string;
  startLabel: string;
  goal: string;
  busy: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onPolicyChange: (value: ComposerPolicy) => void;
  onPickWorkspace: () => void;
  onOpenProviders: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function NewTaskComposer({
  title,
  subtitle,
  placeholder,
  workspace,
  workspaceName,
  chooseProjectLabel,
  modelLabel,
  modelRef,
  models,
  noModelsLabel,
  policy,
  policyLabels,
  localLabel,
  hint,
  startLabel,
  goal,
  busy,
  textareaRef,
  onGoalChange,
  onModelChange,
  onPolicyChange,
  onPickWorkspace,
  onOpenProviders,
  onSubmit,
  onKeyDown,
}: Props) {
  const canSubmit = Boolean(workspace && goal.trim());

  return (
    <section className="new-task-workspace">
      <div className="new-task-copy">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <form className="new-task-composer" onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={4}
          autoFocus
        />

        <div className="new-task-controls">
          <div className="new-task-context">
            <button className="composer-context-button" type="button" onClick={onPickWorkspace}>
              <Folder size={14} strokeWidth={1.7} aria-hidden />
              <span>{workspace ? workspaceName : chooseProjectLabel}</span>
            </button>

            <label className="composer-select-control">
              <span className="sr-only">{modelLabel}</span>
              <select value={modelRef} onChange={(event) => onModelChange(event.target.value)}>
                <option value="">{noModelsLabel}</option>
                {models.map((item) => (
                  <option key={item.ref} value={item.ref}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="composer-select-control">
              <span className="sr-only">Permission</span>
              <select
                value={policy}
                onChange={(event) => onPolicyChange(event.target.value as ComposerPolicy)}
              >
                <option value="read-only">{policyLabels["read-only"]}</option>
                <option value="workspace">{policyLabels.workspace}</option>
                <option value="full">{policyLabels.full}</option>
              </select>
            </label>

            <span className="composer-static-control">
              <HardDrive size={13} strokeWidth={1.7} aria-hidden />
              {localLabel}
            </span>
          </div>

          <div className="new-task-actions">
            {!models.length && (
              <button className="composer-provider-link" type="button" onClick={onOpenProviders}>
                <Settings2 size={13} strokeWidth={1.7} aria-hidden />
                {modelLabel}
              </button>
            )}
            <span className="new-task-hint">{hint}</span>
            <button
              className="new-task-send"
              type="submit"
              disabled={!canSubmit || busy}
              aria-label={startLabel}
              title={!workspace ? chooseProjectLabel : startLabel}
            >
              <ArrowUp size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
