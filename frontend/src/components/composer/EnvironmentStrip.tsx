import { useEffect, useRef, useState } from "react";
import type { RuntimeKind, SessionRuntime } from "../../types";
import { AnchoredPopover } from "../primitives/AnchoredPopover";
import { Icon } from "../primitives/Icon";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import type { ComposerCopy } from "./Composer";
import "./environment-strip.css";

type Common = {
  copy: ComposerCopy;
  projectName: string;
  projectPath: string;
  disabled?: boolean;
};

type Props = Common &
  (
    | {
        variant: "new";
        /** The execution environment chosen for the session that is about to start. */
        runtime: RuntimeKind;
        onRuntimeChange: (runtime: RuntimeKind) => void;
        onPickWorkspace: () => void;
      }
    | {
        variant: "thread";
        /** The session's fixed runtime: chosen at creation, never switched mid-session. */
        runtime: SessionRuntime;
      }
  );

// The slim strip above the composer card, shared by the new-task screen and the thread dock. The
// project is a read-only label (the sidebar switcher is the only selector); the execution target
// is Local or Worktree. On the new-task screen a gear opens the environment popover where the
// Local/Worktree choice and its fixed base branch live. In a thread the same strip shows the
// session's runtime identity, read-only, because the environment is fixed at creation (ADR-0005).
export function EnvironmentStrip(props: Props) {
  const { copy, projectName, projectPath, disabled = false, variant } = props;
  const [open, setOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  const worktree = typeof props.runtime === "string" ? props.runtime === "worktree" : props.runtime.kind === "worktree";

  // Escape and outside presses close the popover; focus returns to the gear so the keyboard flow
  // never falls into the textarea.
  useEffect(() => {
    if (!open) return;
    return () => gearRef.current?.focus();
  }, [open]);

  return (
    <div className={`composer-env ${variant === "thread" ? "is-read-only" : ""}`} role="group" aria-label={copy.environment}>
      <span className="env-left">
        {projectName ? (
          <span className="env-project" title={projectPath}>
            <Icon name="project" size={13} />
            <span className="env-project-name">{projectName}</span>
          </span>
        ) : props.variant === "new" ? (
          <button
            type="button"
            className="env-open-project"
            onClick={props.onPickWorkspace}
            title={copy.openProject}
          >
            <Icon name="projectOpen" size={13} />
            <span>{copy.openProject}</span>
          </button>
        ) : null}
        {variant === "thread" ? (
          <span className="env-runtime" title={copy.runtimeFixed}>
            <RuntimeIdentity
              runtime={props.runtime}
              localLabel={copy.localRuntime}
              worktreeLabel={copy.worktreeRuntime}
              compact
            />
          </span>
        ) : (
          projectName && (
            <span
              className={`env-target ${worktree ? "is-worktree" : ""}`}
              aria-label={`${copy.executionTarget}: ${worktree ? copy.worktreeRuntime : copy.localRuntime}`}
              title={worktree ? copy.worktreeRuntimeDescription : copy.localRuntimeDescription}
            >
              <Icon name={worktree ? "worktree" : "local"} size={13} />
              <span>{worktree ? copy.worktreeRuntime : copy.localRuntime}</span>
            </span>
          )
        )}
      </span>

      {variant === "new" && (
        <span className="env-actions">
          <button
            ref={gearRef}
            type="button"
            className="icon-btn is-sm"
            disabled={disabled || !projectName}
            onClick={() => setOpen(!open)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={copy.configureEnvironment}
            title={!projectName ? copy.openProject : copy.configureEnvironment}
          >
            <Icon name="settings" size={14} />
          </button>
          <AnchoredPopover
            open={open}
            onClose={() => setOpen(false)}
            placement="above-end"
            label={copy.configureEnvironment}
            className="env-popover"
          >
            <div className="env-popover-title">{copy.configureEnvironment}</div>
            <div className="env-setting">
              <span className="env-setting-body">
                <span className="env-setting-name">{copy.newWorktree}</span>
                <span className="env-setting-sub">{copy.worktreeRuntimeDescription}</span>
              </span>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={worktree}
                aria-label={copy.newWorktree}
                disabled={disabled}
                onClick={() => props.onRuntimeChange(worktree ? "local" : "worktree")}
              >
                <span />
              </button>
            </div>
            <div className="env-setting is-static">
              <span className="env-setting-name">
                <Icon name="commit" size={13} />
                {copy.branch}
              </span>
              <span className="env-setting-value mono" title={copy.baseBranchFixed}>{copy.scmHead}</span>
            </div>
            <p className="env-popover-note">{copy.baseBranchHint}</p>
            <p className="env-popover-note">{copy.runtimeFixedHint}</p>
          </AnchoredPopover>
        </span>
      )}
    </div>
  );
}
