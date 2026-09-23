import type { FormEvent, KeyboardEvent, Ref } from "react";
import { ArrowUp, Folder, Settings2 } from "lucide-react";
import { DesktopSelect, type SelectOption } from "../primitives/Select";
import { ContextAttachments } from "./ContextAttachments";
import "./new-task-composer.css";

export type ComposerPolicy = "read-only" | "workspace" | "full";
export type ComposerRuntime = "local" | "worktree";

type ModelOption = {
  ref: string;
  label: string;
  description?: string;
  group?: string;
  badge?: string;
  badgeTone?: "default" | "warning";
};

type Props = {
  title: string;
  subtitle: string;
  placeholder: string;
  workspace: string;
  workspaceName: string;
  recentProjects: string[];
  recentProjectsLabel: string;
  chooseProjectLabel: string;
  modelLabel: string;
  modelSearchLabel: string;
  noModelMatchesLabel: string;
  modelRef: string;
  models: ModelOption[];
  noModelsLabel: string;
  contextPaths: string[];
  contextLabels: {
    context: string;
    files: string;
    folder: string;
    remove: string;
  };
  policyLabel: string;
  policy: ComposerPolicy;
  policyLabels: Record<ComposerPolicy, string>;
  policyDescriptions: Record<ComposerPolicy, string>;
  environmentLabel: string;
  runtime: ComposerRuntime;
  runtimeLabels: Record<ComposerRuntime, string>;
  runtimeDescriptions: Record<ComposerRuntime, string>;
  hint: string;
  startLabel: string;
  goal: string;
  busy: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  onPolicyChange: (value: ComposerPolicy) => void;
  onRuntimeChange: (value: ComposerRuntime) => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
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
  recentProjects,
  recentProjectsLabel,
  chooseProjectLabel,
  modelLabel,
  modelSearchLabel,
  noModelMatchesLabel,
  modelRef,
  models,
  noModelsLabel,
  contextPaths,
  contextLabels,
  policyLabel,
  policy,
  policyLabels,
  policyDescriptions,
  environmentLabel,
  runtime,
  runtimeLabels,
  runtimeDescriptions,
  hint,
  startLabel,
  goal,
  busy,
  textareaRef,
  onGoalChange,
  onModelChange,
  onPickContextFiles,
  onPickContextFolder,
  onRemoveContextPath,
  onPolicyChange,
  onRuntimeChange,
  onPickWorkspace,
  onOpenWorkspace,
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
          aria-label={title}
          rows={4}
          autoFocus
        />

        <ContextAttachments
          paths={contextPaths}
          disabled={!workspace || busy}
          labels={contextLabels}
          onPickFiles={onPickContextFiles}
          onPickFolder={onPickContextFolder}
          onRemove={onRemoveContextPath}
        />

        <div className="new-task-controls">
          <div className="new-task-context">
            <button className="composer-context-button" type="button" onClick={onPickWorkspace}>
              <Folder size={14} strokeWidth={1.7} aria-hidden />
              <span>{workspace ? workspaceName : chooseProjectLabel}</span>
            </button>

            {!workspace && recentProjects.length > 0 && (
              <DesktopSelect
                ariaLabel={recentProjectsLabel}
                value={workspace}
                placeholder={recentProjectsLabel}
                className="composer-desktop-select project-select"
                showDescriptionInTrigger={false}
                options={recentProjects.map<SelectOption>((path) => ({
                  value: path,
                  label: path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path,
                  description: path,
                }))}
                onChange={onOpenWorkspace}
              />
            )}

            <DesktopSelect
              ariaLabel={modelLabel}
              value={modelRef}
              placeholder={noModelsLabel}
              className="composer-desktop-select model-select"
              showDescriptionInTrigger={false}
              search={{
                ariaLabel: modelSearchLabel,
                placeholder: modelSearchLabel,
                emptyLabel: noModelMatchesLabel,
              }}
              options={models.map<SelectOption>((item) => ({
                value: item.ref,
                label: item.label,
                description: item.description,
                group: item.group,
                badge: item.badge,
                badgeTone: item.badgeTone,
              }))}
              onChange={onModelChange}
            />

            <DesktopSelect
              ariaLabel={policyLabel}
              value={policy}
              placeholder={policyLabels.workspace}
              className="composer-desktop-select policy-select"
              showDescriptionInTrigger={false}
              options={[
                { value: "read-only", label: policyLabels["read-only"], description: policyDescriptions["read-only"] },
                { value: "workspace", label: policyLabels.workspace, description: policyDescriptions.workspace },
                { value: "full", label: policyLabels.full, description: policyDescriptions.full },
              ]}
              onChange={(value) => onPolicyChange(value as ComposerPolicy)}
            />

            <DesktopSelect
              ariaLabel={environmentLabel}
              value={runtime}
              placeholder={runtimeLabels.local}
              className="composer-desktop-select environment-select"
              showDescriptionInTrigger={false}
              options={[
                {
                  value: "local",
                  label: runtimeLabels.local,
                  description: runtimeDescriptions.local,
                },
                {
                  value: "worktree",
                  label: runtimeLabels.worktree,
                  description: runtimeDescriptions.worktree,
                },
              ]}
              onChange={(value) => onRuntimeChange(value as ComposerRuntime)}
            />
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
