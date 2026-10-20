import type { FormEvent, Ref } from "react";
import { BrandMark } from "../brand/A1Mark";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEffort, AgentPolicy, RuntimeKind } from "../../types";
import { Composer, type ComposerAgent, type ComposerCopy } from "./Composer";
import { EnvironmentStrip } from "./EnvironmentStrip";
import { type PickerOption } from "./ComposerPickers";
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
  notice?: React.ReactNode;
  goal: string;
  busy: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  contextPaths: string[];
  agent: ComposerAgent;
  policy: ComposerPolicy;
  models: PickerOption[];
  modelRef: string;
  recentModelRefs: string[];
  effort?: AgentEffort;
  effortOptions: string[];
  /** The execution environment, chosen here and fixed once the session starts. */
  runtime: ComposerRuntime;
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onEffortChange: (effort: AgentEffort | undefined) => void;
  onPolicyChange: (value: ComposerPolicy) => void;
  onRuntimeChange: (value: ComposerRuntime) => void;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  onPickWorkspace: () => void;
  onOpenProviders: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

// The new-task screen: mark, title, the shared composer card with the environment strip attached
// above it. Local/Worktree is chosen in the strip's environment popover and fixed at session
// creation (ADR-0005); the project itself is a read-only label because the sidebar's project
// switcher is the only selector.
export function NewTaskComposer({
  title,
  subtitle,
  copy,
  workspace,
  workspaceName,
  notice,
  goal,
  busy,
  textareaRef,
  contextPaths,
  agent,
  policy,
  models,
  modelRef,
  recentModelRefs,
  effort,
  effortOptions,
  runtime,
  onGoalChange,
  onModelChange,
  onEffortChange,
  onPolicyChange,
  onRuntimeChange,
  onPickContextFiles,
  onPickContextFolder,
  onRemoveContextPath,
  onPickWorkspace,
  onOpenProviders,
  onSubmit,
}: Props) {
  const canSubmit = Boolean(workspace && goal.trim());
  const heading = workspaceName ? title.replace("{project}", workspaceName) : title;

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
          agent={agent}
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
          environment={
            <EnvironmentStrip
              variant="new"
              copy={copy}
              projectName={workspaceName}
              projectPath={workspace}
              runtime={runtime}
              disabled={busy || !workspace}
              onRuntimeChange={onRuntimeChange}
              onPickWorkspace={onPickWorkspace}
            />
          }
          sendTitle={workspace ? undefined : copy.openProject}
        />
      </div>
    </div>
  );
}
