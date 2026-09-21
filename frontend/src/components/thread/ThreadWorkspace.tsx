import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  Ref,
} from "react";
import { ArrowUp, CircleCheck, Folder, Square } from "lucide-react";
import type { Message, Session, WorkflowSummary } from "../../types";
import { DesktopSelect, type SelectOption } from "../primitives/Select";
import { ApprovalCard } from "./ApprovalCard";
import { Markdown } from "./Markdown";
import { MessageItem } from "./MessageItem";

type Props = {
  session: Session;
  messages: Message[];
  running: boolean;
  statusLabel: string;
  workspaceName: string;
  modelRef: string;
  models: SelectOption[];
  policyLabel: string;
  goal: string;
  busy: boolean;
  workflowSummary?: WorkflowSummary | null;
  textareaRef: Ref<HTMLTextAreaElement>;
  labels: {
    newTask: string;
    running: string;
    noMessages: string;
    finalAnswer: string;
    startAnother: string;
    composerPlaceholder: string;
    composerHint: string;
    noModels: string;
    start: string;
    roleUser: string;
    roleAssistant: string;
    roleTool: string;
    roleSystem: string;
    approvalTitle: string;
    approve: string;
  };
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApproveGate: (gateId: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function ThreadWorkspace({
  session,
  messages,
  running,
  statusLabel,
  workspaceName,
  modelRef,
  models,
  policyLabel,
  goal,
  busy,
  workflowSummary,
  textareaRef,
  labels,
  onGoalChange,
  onModelChange,
  onApproveGate,
  onCancel,
  onSubmit,
  onKeyDown,
}: Props) {
  return (
    <>
      <div className="thread-view">
        <div className="thread-content">
          <section className="task-intro">
            <div className="task-icon" aria-hidden>LC</div>
            <div>
              <span>{labels.newTask}</span>
              <h1>{session.goal}</h1>
              <div className="task-meta">
                <span className={`status-pill ${running ? "running" : session.status}`}>{statusLabel}</span>
                {session.provider && <span>{session.provider}</span>}
                {session.model && <span>{session.model}</span>}
              </div>
            </div>
          </section>

          <section className="message-list">
            {messages.map((message) => (
              <MessageItem
                key={`${message.seq}-${message.role}`}
                message={message}
                labels={{
                  roleUser: labels.roleUser,
                  roleAssistant: labels.roleAssistant,
                  roleTool: labels.roleTool,
                  roleSystem: labels.roleSystem,
                }}
              />
            ))}

            {!messages.length && (
              <div className="inline-empty">
                {running && <span className="thinking-pulse"><i /><i /><i /></span>}
                <p>{running ? labels.running : labels.noMessages}</p>
              </div>
            )}
          </section>

          {workflowSummary && session.status === "waiting_gate" && (
            <ApprovalCard
              summary={workflowSummary}
              busy={busy}
              approveLabel={labels.approve}
              titleLabel={labels.approvalTitle}
              onApprove={onApproveGate}
            />
          )}

          {session.final && (
            <section className="final-result">
              <div className="final-label">
                <CircleCheck size={14} strokeWidth={1.7} aria-hidden />
                {labels.finalAnswer}
              </div>
              <Markdown text={session.final} />
            </section>
          )}
        </div>
      </div>

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
    </>
  );
}
