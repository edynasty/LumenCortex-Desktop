import type { FormEvent, KeyboardEvent, Ref } from "react";
import { BrandMark } from "../brand/A1Mark";
import { Icon } from "../primitives/Icon";
import { ContextAttachments, ContextAttachTrigger } from "./ContextAttachments";
import { MenuPicker, ModelPicker, type PickerOption } from "./ComposerPickers";
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
  /** Title template; `{project}` is replaced with the open workspace's name. */
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
  notice?: React.ReactNode;
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

const policyIcon = { "read-only": "readOnly", workspace: "permission", full: "permissionFull" } as const;
const runtimeIcon = { local: "local", worktree: "worktree" } as const;

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
  notice,
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
  const heading = workspaceName ? title.replace("{project}", workspaceName) : title;
  const modelOptions: PickerOption[] = models.map((item) => ({
    value: item.ref,
    label: item.label,
    description: item.description,
    group: item.group,
    badge: item.badge,
    badgeTone: item.badgeTone,
  }));

  return (
    <div className="new-thread">
      {notice}
      <div className="new-thread-center">
        <BrandMark size={34} className="new-thread-mark" />
        <h2>{heading}</h2>
        <p className="new-thread-sub">{subtitle}</p>

        <form className="composer is-new" onSubmit={onSubmit}>
          <textarea
            ref={textareaRef}
            value={goal}
            onChange={(event) => onGoalChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            rows={3}
            autoFocus
          />
          <ContextAttachments paths={contextPaths} labels={contextLabels} onRemove={onRemoveContextPath} />
          <div className="composer-bar" onClick={(event) => event.stopPropagation()}>
            <ContextAttachTrigger
              disabled={!workspace || busy}
              labels={contextLabels}
              count={contextPaths.length}
              onPickFiles={onPickContextFiles}
              onPickFolder={onPickContextFolder}
            />
            {workspace ? (
              <button type="button" className="chip is-static is-collapsible" onClick={onPickWorkspace} title={workspace} aria-label={workspaceName}>
                <Icon name="project" size={14} />
                <span className="chip-label">{workspaceName}</span>
              </button>
            ) : (
              <>
                <button type="button" className="chip" onClick={onPickWorkspace}>
                  <Icon name="projectOpen" size={14} />
                  <span className="chip-label">{chooseProjectLabel}</span>
                </button>
                {recentProjects.length > 0 && (
                  <MenuPicker
                    ariaLabel={recentProjectsLabel}
                    value=""
                    placeholder={recentProjectsLabel}
                    options={recentProjects.map((path) => ({
                      value: path,
                      label: path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path,
                      description: path,
                    }))}
                    onChange={onOpenWorkspace}
                  />
                )}
              </>
            )}
            <ModelPicker
              ariaLabel={modelLabel}
              value={modelRef}
              options={modelOptions}
              placeholder={noModelsLabel}
              searchLabel={modelSearchLabel}
              emptyLabel={noModelMatchesLabel}
              disabled={busy}
              onChange={onModelChange}
              footer={{ label: modelLabel, onSelect: onOpenProviders }}
            />
            <MenuPicker
              ariaLabel={policyLabel}
              value={policy}
              placeholder={policyLabels.workspace}
              options={(Object.keys(policyLabels) as ComposerPolicy[]).map((value) => ({
                value,
                label: policyLabels[value],
                description: policyDescriptions[value],
                icon: policyIcon[value],
              }))}
              onChange={(value) => onPolicyChange(value as ComposerPolicy)}
            />
            <MenuPicker
              ariaLabel={environmentLabel}
              collapsible
              value={runtime}
              placeholder={runtimeLabels.local}
              options={(Object.keys(runtimeLabels) as ComposerRuntime[]).map((value) => ({
                value,
                label: runtimeLabels[value],
                description: runtimeDescriptions[value],
                icon: runtimeIcon[value],
              }))}
              onChange={(value) => onRuntimeChange(value as ComposerRuntime)}
            />
            <span className="composer-spacer" />
            <span className="composer-hint"><span className="composer-hint-text">{hint}</span></span>
            <button
              className="send-btn"
              type="submit"
              disabled={!canSubmit || busy}
              aria-label={startLabel}
              title={!workspace ? chooseProjectLabel : startLabel}
            >
              <Icon name="send" size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
