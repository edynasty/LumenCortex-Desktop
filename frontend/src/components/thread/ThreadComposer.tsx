import type { FormEvent, ReactNode, Ref } from "react";
import type { AgentEffort, SessionRuntime } from "../../types";
import type { AgentMode, AgentPolicy } from "../../app/agent-config";
import type { PickerOption } from "../composer/ComposerPickers";
import { Composer, type ComposerAgent, type ComposerCopy } from "../composer/Composer";
import { EnvironmentStrip } from "../composer/EnvironmentStrip";

type Props = {
  runtime: SessionRuntime;
  copy: ComposerCopy;
  /** The open project, shown as a read-only label in the environment strip. */
  projectName: string;
  projectPath: string;
  modelRef: string;
  models: PickerOption[];
  modelPending?: boolean;
  recentModelRefs: string[];
  onOpenProviders: () => void;
  effort?: AgentEffort;
  effortOptions: string[];
  mode: AgentMode;
  agent: ComposerAgent;
  policy: AgentPolicy;
  // The thread's delegation grant control; absent where a thread cannot hold one.
  delegationControl?: ReactNode;
  contextPaths: string[];
  goal: string;
  running: boolean;
  busy: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onPolicyChange: (policy: AgentPolicy) => void;
  onEffortChange: (effort: AgentEffort | undefined) => void;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

// The follow-up composer: the shared Composer card docked at the thread's foot. The session's
// runtime identity rides in the strip above the input, read-only — the execution environment was
// chosen at session creation and never switches mid-session (ADR-0005).
export function ThreadComposer({
  runtime,
  copy,
  projectName,
  projectPath,
  modelRef,
  models,
  modelPending,
  recentModelRefs,
  onOpenProviders,
  effort,
  effortOptions,
  mode,
  agent,
  policy,
  delegationControl,
  contextPaths,
  goal,
  running,
  busy,
  textareaRef,
  onGoalChange,
  onModelChange,
  onPolicyChange,
  onEffortChange,
  onPickContextFiles,
  onPickContextFolder,
  onRemoveContextPath,
  onCancel,
  onSubmit,
}: Props) {
  return (
    <div className="composer-dock">
      <Composer
        variant="thread"
        copy={copy}
        value={goal}
        onValueChange={onGoalChange}
        onSubmit={onSubmit}
        textareaRef={textareaRef}
        busy={busy}
        canSubmit={Boolean(goal.trim())}
        running={running}
        onCancel={onCancel}
        contextPaths={contextPaths}
        onPickContextFiles={onPickContextFiles}
        onPickContextFolder={onPickContextFolder}
        onRemoveContextPath={onRemoveContextPath}
        mode={mode}
        agent={agent}
        policy={policy}
        onPolicyChange={onPolicyChange}
        delegationControl={delegationControl}
        models={models}
        modelRef={modelRef}
        modelPending={modelPending}
        onModelChange={onModelChange}
        recentModelRefs={recentModelRefs}
        onOpenProviders={onOpenProviders}
        effort={effort}
        effortOptions={effortOptions}
        onEffortChange={onEffortChange}
        environment={
          <EnvironmentStrip
            variant="thread"
            copy={copy}
            projectName={projectName}
            projectPath={projectPath}
            runtime={runtime}
          />
        }
      />
    </div>
  );
}
