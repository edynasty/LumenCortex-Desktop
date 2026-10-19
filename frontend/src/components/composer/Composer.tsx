import {
  useEffect,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type ReactNode,
  type Ref,
} from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEffort } from "../../types";
import type { AgentMode, AgentPolicy } from "../../app/agent-config";
import { ContextAttachments, ContextAttachTrigger } from "./ContextAttachments";
import { ModelPicker, type ModelPickerHandle, type PickerOption } from "./ComposerPickers";
import { MenuPicker } from "./MenuPicker";
import { Icon } from "../primitives/Icon";
import "./composer.css";

/** The composer's copy: the whole app copy plus the picker placeholder, which depends on config. */
export type ComposerCopy = AppCopy & { noModels: string };

export const COMPOSER_MAX_HEIGHT = 220;

type Props = {
  /** "new" is the new-task card; "thread" is the docked follow-up composer. */
  variant: "new" | "thread";
  copy: ComposerCopy;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  autoFocus?: boolean;
  busy: boolean;
  canSubmit: boolean;
  /** A run is live: the right edge becomes Stop. */
  running?: boolean;
  onCancel?: () => void;
  // Context attachments (chips row above the input; the (+) trigger opens the pick menu).
  contextPaths: string[];
  contextDisabled?: boolean;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  // Ask/Agent mode; Ask caps the turn to read-only/none and disables the two Core controls.
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  // The user's authorization policy and delegation grant, applied unchanged in Agent mode.
  policy: AgentPolicy;
  onPolicyChange: (policy: AgentPolicy) => void;
  delegationControl?: ReactNode;
  // Model + reasoning effort, on the right next to Send/Stop.
  models: PickerOption[];
  modelRef: string;
  modelPending?: boolean;
  onModelChange: (ref: string) => void;
  recentModelRefs: string[];
  onOpenProviders: () => void;
  effort?: AgentEffort;
  effortOptions: string[];
  onEffortChange: (effort: AgentEffort | undefined) => void;
  // The new task's project chip; the thread's read-only runtime identity.
  leftSlot?: ReactNode;
  runtimeSlot?: ReactNode;
  /** Replaces the send button's tooltip when the task cannot start (e.g. no project open). */
  sendTitle?: string;
};

const modeIcon: Record<AgentMode, "discussion" | "subagent"> = { ask: "discussion", agent: "subagent" };
const policyIcon: Record<AgentPolicy, "readOnly" | "permission" | "permissionFull"> = {
  "read-only": "readOnly",
  workspace: "permission",
  full: "permissionFull",
};
const effortIconByLevel: Record<AgentEffort, "idle" | "effort" | "plan" | "workflow" | "checkRun"> = {
  none: "idle",
  low: "effort",
  medium: "plan",
  high: "workflow",
  max: "checkRun",
};
const effortLabelKey: Record<AgentEffort, "effortNone" | "effortLow" | "effortMedium" | "effortHigh" | "effortMax"> = {
  none: "effortNone",
  low: "effortLow",
  medium: "effortMedium",
  high: "effortHigh",
  max: "effortMax",
};

// The shared composer surface (Codex / Copilot Chat pattern over Lumen Glass): one rounded glass
// card with an auto-growing textarea, attachment chips above, and one compact toolbar — left:
// attach, Ask/Agent, authorization, delegation; right: model, effort, Send/Stop. The same
// component renders the new-task card and the thread follow-up so both stay consistent.
export function Composer({
  variant,
  copy,
  value,
  onValueChange,
  onSubmit,
  textareaRef,
  autoFocus,
  busy,
  canSubmit,
  running,
  onCancel,
  contextPaths,
  contextDisabled,
  onPickContextFiles,
  onPickContextFolder,
  onRemoveContextPath,
  mode,
  onModeChange,
  policy,
  onPolicyChange,
  delegationControl,
  models,
  modelRef,
  modelPending,
  onModelChange,
  recentModelRefs,
  onOpenProviders,
  effort,
  effortOptions,
  onEffortChange,
  leftSlot,
  runtimeSlot,
  sendTitle,
}: Props) {
  const innerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modelPickerRef = useRef<ModelPickerHandle>(null);
  const ask = mode === "ask";

  // The caller's ref (the app focuses the composer on new task) and the internal one share the node.
  const setTextarea = (element: HTMLTextAreaElement | null) => {
    innerTextareaRef.current = element;
    if (typeof textareaRef === "function") textareaRef(element);
    else if (textareaRef && "current" in textareaRef) {
      const mutable = textareaRef as { current: HTMLTextAreaElement | null }; // React's Ref union lost the mutable RefObject shape
      mutable.current = element;
    }
  };

  // Auto-grow within the CSS cap: the input opens at one line and grows with its content.
  useLayoutEffect(() => {
    const element = innerTextareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [value]);

  // Global shortcuts: ⌘/ focuses the composer, ⌘⇧M opens the model picker (no other command in the
  // window shell uses these).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "m") {
        event.preventDefault();
        modelPickerRef.current?.open();
      } else if (!event.shiftKey && key === "/") {
        event.preventDefault();
        innerTextareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Enter sends, Shift+Enter breaks a line. During IME composition Enter confirms the composition
  // (isComposing, or the 229 keyCode Safari reports) and must never send.
  const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  // Without supported levels the picker offers nothing: the chip shows the not-configurable
  // placeholder and stays disabled, so no effort is ever claimed or sent.
  const effortChoices: PickerOption[] = effortOptions.length
    ? [
        { value: "", label: copy.effortDefault },
        ...effortOptions.map((level) => ({
          value: level,
          label: copy[effortLabelKey[level as AgentEffort]],
          icon: effortIconByLevel[level as AgentEffort],
        })),
      ]
    : [];

  return (
    <form
      className={`composer ${variant === "new" ? "is-new" : ""} ${running ? "is-running" : ""}`}
      onSubmit={onSubmit}
    >
      <textarea
        ref={setTextarea}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onTextareaKeyDown}
        placeholder={variant === "new" ? copy.composerPlaceholder : copy.startAnother}
        aria-label={variant === "new" ? copy.composerPlaceholder : copy.startAnother}
        rows={variant === "new" ? 3 : 1}
        autoFocus={autoFocus}
        disabled={busy && running}
      />
      <ContextAttachments
        paths={contextPaths}
        labels={{ context: copy.context, remove: copy.removeContext }}
        onRemove={onRemoveContextPath}
      />
      <div className="composer-bar" onClick={(event) => event.stopPropagation()}>
        <ContextAttachTrigger
          disabled={contextDisabled || busy}
          labels={{ context: copy.context, files: copy.attachFiles, folder: copy.attachFolder, remove: copy.removeContext }}
          count={contextPaths.length}
          onPickFiles={onPickContextFiles}
          onPickFolder={onPickContextFolder}
        />
        <MenuPicker
          ariaLabel={copy.mode}
          collapsible
          value={mode}
          placeholder={copy.modeAgent}
          disabled={busy}
          options={[
            { value: "ask", label: copy.modeAsk, description: copy.modeAskDescription, icon: modeIcon.ask },
            { value: "agent", label: copy.modeAgent, description: copy.modeAgentDescription, icon: modeIcon.agent },
          ]}
          onChange={(next) => onModeChange(next as AgentMode)}
        />
        <MenuPicker
          ariaLabel={copy.policy}
          collapsible
          value={policy}
          placeholder={copy.workspace}
          disabled={busy || ask}
          disabledReason={ask ? copy.askCapsControls : undefined}
          options={[
            { value: "read-only", label: copy.readOnly, description: copy.readOnlyDescription, icon: policyIcon["read-only"] },
            { value: "workspace", label: copy.workspace, description: copy.workspaceDescription, icon: policyIcon.workspace },
            { value: "full", label: copy.full, description: copy.fullDescription, icon: policyIcon.full },
          ]}
          onChange={(next) => onPolicyChange(next as AgentPolicy)}
        />
        {delegationControl}
        {leftSlot}
        {runtimeSlot}
        <span className="composer-spacer" />
        <span className="composer-hint"><span className="composer-hint-text">{copy.composerHint}</span></span>
        <ModelPicker
          ref={modelPickerRef}
          ariaLabel={copy.modelSelect}
          value={modelRef}
          options={models}
          placeholder={copy.noModels}
          searchLabel={copy.modelSearch}
          emptyLabel={copy.noModelMatches}
          recentLabel={copy.recentModels}
          recentRefs={recentModelRefs}
          pendingLabel={modelPending ? copy.modelPending : undefined}
          disabled={busy}
          onChange={onModelChange}
          footer={{ label: copy.providerSettings, onSelect: onOpenProviders }}
        />
        <MenuPicker
          ariaLabel={copy.effortLabel}
          collapsible
          placement="above-end"
          value={effort ?? ""}
          placeholder={copy.effortNotConfigurable}
          disabled={busy || !effortOptions.length}
          disabledReason={effortOptions.length ? undefined : copy.effortNotConfigurable}
          options={effortChoices}
          onChange={(next) => onEffortChange(next === "" ? undefined : (next as AgentEffort))}
        />
        {running ? (
          <button
            className="send-btn is-stop"
            type="button"
            disabled={busy}
            aria-label={copy.stop}
            title={copy.stop}
            onClick={onCancel}
          >
            <Icon name="stop" size={13} />
          </button>
        ) : (
          <button
            className="send-btn"
            type="submit"
            disabled={!canSubmit || busy}
            aria-label={variant === "new" ? copy.start : copy.resume}
            title={sendTitle ?? (variant === "new" ? copy.start : copy.resume)}
          >
            <Icon name="send" size={16} />
          </button>
        )}
      </div>
    </form>
  );
}
