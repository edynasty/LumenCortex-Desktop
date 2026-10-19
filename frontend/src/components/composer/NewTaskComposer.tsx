import type { FormEvent, ReactNode, Ref } from "react";
import { BrandMark } from "../brand/A1Mark";
import { Icon } from "../primitives/Icon";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEffort, RuntimeKind } from "../../types";
import type { AgentMode, AgentPolicy } from "../../app/agent-config";
import { Composer, type ComposerCopy } from "./Composer";
import { type PickerOption } from "./ComposerPickers";
import { MenuPicker } from "./MenuPicker";
import "./new-task-composer.css";

export type ComposerPolicy = AgentPolicy;
export type ComposerRuntime = RuntimeKind;

type Props = {
  /** Title template; `{project}` is replaced with the open workspace's name. */
  title: string;
  subtitle: string;
  copy: ComposerCopy;
  workspace: string;
  workspaceName: string;
  recentProjects: string[];
  notice?: React.ReactNode;
  goal: string;
  busy: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  contextPaths: string[];
  mode: AgentMode;
  policy: ComposerPolicy;
  models: PickerOption[];
  modelRef: string;
  recentModelRefs: string[];
  effort?: AgentEffort;
  effortOptions: string[];
  /** The execution environment, chosen here and fixed once the session starts. */
  runtime: ComposerRuntime;
  onGoalChange: (value: string) => void;
  onModeChange: (mode: AgentMode) => void;
  onModelChange: (value: string) => void;
  onEffortChange: (effort: AgentEffort | undefined) => void;
  onPolicyChange: (value: ComposerPolicy) => void;
  onRuntimeChange: (value: ComposerRuntime) => void;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onOpenProviders: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const runtimeIcon: Record<ComposerRuntime, "local" | "worktree"> = { local: "local", worktree: "worktree" };

// The new-task screen: mark, title, the shared composer card, and below it the execution
// environment row — the one place Local/Worktree is chosen, because runtime identity is fixed at
// session creation (ADR-0005) and never switches mid-session.
export function NewTaskComposer({
  title,
  subtitle,
  copy,
  workspace,
  workspaceName,
  recentProjects,
  notice,
  goal,
  busy,
  textareaRef,
  contextPaths,
  mode,
  policy,
  models,
  modelRef,
  recentModelRefs,
  effort,
  effortOptions,
  runtime,
  onGoalChange,
  onModeChange,
  onModelChange,
  onEffortChange,
  onPolicyChange,
  onRuntimeChange,
  onPickContextFiles,
  onPickContextFolder,
  onRemoveContextPath,
  onPickWorkspace,
  onOpenWorkspace,
  onOpenProviders,
  onSubmit,
}: Props) {
  const canSubmit = Boolean(workspace && goal.trim());
  const heading = workspaceName ? title.replace("{project}", workspaceName) : title;

  const projectSlot = workspace ? (
    <button
      type="button"
      className="chip is-static is-collapsible"
      onClick={onPickWorkspace}
      title={workspace}
      aria-label={workspaceName}
    >
      <Icon name="project" size={14} />
      <span className="chip-label">{workspaceName}</span>
    </button>
  ) : (
    <>
      <button type="button" className="chip" onClick={onPickWorkspace}>
        <Icon name="projectOpen" size={14} />
        <span className="chip-label">{copy.openProject}</span>
      </button>
      {recentProjects.length > 0 && (
        <MenuPicker
          ariaLabel={copy.recentProjects}
          value=""
          placeholder={copy.recentProjects}
          options={recentProjects.map((path) => ({
            value: path,
            label: path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path,
            description: path,
          }))}
          onChange={onOpenWorkspace}
        />
      )}
    </>
  );

  return (
    <div className="new-thread">
      {notice}
      <div className="new-thread-center">
        <BrandMark size={34} className="new-thread-mark" />
        <h2>{heading}</h2>
        <p className="new-thread-sub">{subtitle}</p>

        <Composer
          variant="new"
          copy={copy}
          value={goal}
          onValueChange={onGoalChange}
          onSubmit={onSubmit}
          textareaRef={textareaRef}
          autoFocus
          busy={busy}
          canSubmit={canSubmit}
          contextPaths={contextPaths}
          contextDisabled={!workspace}
          onPickContextFiles={onPickContextFiles}
          onPickContextFolder={onPickContextFolder}
          onRemoveContextPath={onRemoveContextPath}
          mode={mode}
          onModeChange={onModeChange}
          policy={policy}
          onPolicyChange={onPolicyChange}
          models={models}
          modelRef={modelRef}
          onModelChange={onModelChange}
          recentModelRefs={recentModelRefs}
          onOpenProviders={onOpenProviders}
          effort={effort}
          effortOptions={effortOptions}
          onEffortChange={onEffortChange}
          leftSlot={projectSlot}
          sendTitle={workspace ? undefined : copy.openProject}
        />

        <div className="new-thread-exec">
          <span className="exec-label">{copy.environment}</span>
          <MenuPicker
            ariaLabel={copy.environment}
            value={runtime}
            placeholder={copy.localRuntime}
            disabled={busy || !workspace}
            options={(["local", "worktree"] as ComposerRuntime[]).map((value) => ({
              value,
              label: value === "local" ? copy.localRuntime : copy.worktreeRuntime,
              description: value === "local" ? copy.localRuntimeDescription : copy.worktreeRuntimeDescription,
              icon: runtimeIcon[value],
            }))}
            onChange={(value) => onRuntimeChange(value as ComposerRuntime)}
          />
          <span className="exec-note" title={copy.runtimeFixed}>{copy.runtimeFixedHint}</span>
        </div>
      </div>
    </div>
  );
}
