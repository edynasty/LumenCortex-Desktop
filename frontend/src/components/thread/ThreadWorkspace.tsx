import { useEffect, useRef } from "react";
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  Ref,
} from "react";
import { ArrowUp, CircleCheck, Folder, Square } from "lucide-react";
import type { Message, Session, SessionRuntime, WorkflowSummary } from "../../types";
import { DesktopSelect, type SelectOption } from "../primitives/Select";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import { ApprovalCard } from "./ApprovalCard";
import { Markdown } from "./Markdown";
import { MessageItem } from "./MessageItem";
import { ThreadProgress } from "./ThreadProgress";

type Props = {
  session: Session;
  runtime: SessionRuntime;
  messages: Message[];
  hasOlderMessages: boolean;
  historicalMessages: boolean;
  loadingOlderMessages: boolean;
  running: boolean;
  statusLabel: string;
  workspaceName: string;
  modelRef: string;
  models: SelectOption[];
  policyLabel: string;
  goal: string;
  busy: boolean;
  workflowSummary?: WorkflowSummary | null;
  activeSubagents: number;
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
    loadEarlier: string;
    backToLatest: string;
    historyWindow: string;
    localRuntime: string;
    worktreeRuntime: string;
    plan: string;
    planRunning: string;
    planWaiting: string;
    planSubagents: string;
  };
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApproveGate: (gateId: string) => void;
  onLoadOlderMessages: () => void;
  onJumpToLatest: () => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function ThreadWorkspace({
  session,
  runtime,
  messages,
  hasOlderMessages,
  historicalMessages,
  loadingOlderMessages,
  running,
  statusLabel,
  workspaceName,
  modelRef,
  models,
  policyLabel,
  goal,
  busy,
  workflowSummary,
  activeSubagents,
  textareaRef,
  labels,
  onGoalChange,
  onModelChange,
  onApproveGate,
  onLoadOlderMessages,
  onJumpToLatest,
  onCancel,
  onSubmit,
  onKeyDown,
}: Props) {
  const threadViewRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const element = threadViewRef.current;
    if (!element || historicalMessages || !stickToBottom.current) return;
    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [historicalMessages, messages.length, running]);

  return (
    <>
      <div
        className="thread-view"
        ref={threadViewRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        }}
      >
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
                <RuntimeIdentity
                  runtime={runtime}
                  localLabel={labels.localRuntime}
                  worktreeLabel={labels.worktreeRuntime}
                  compact
                />
              </div>
            </div>
          </section>

          <ThreadProgress
            running={running}
            status={session.status}
            workflow={workflowSummary}
            activeSubagents={activeSubagents}
            labels={{
              plan: labels.plan,
              running: labels.planRunning,
              waiting: labels.planWaiting,
              subagents: labels.planSubagents,
            }}
          />

          <section className="message-list">
            {(hasOlderMessages || historicalMessages) && (
              <div className="thread-history-controls">
                {historicalMessages && <span>{labels.historyWindow}</span>}
                <div>
                  {hasOlderMessages && (
                    <button type="button" disabled={loadingOlderMessages} onClick={onLoadOlderMessages}>
                      {labels.loadEarlier}
                    </button>
                  )}
                  {historicalMessages && (
                    <button type="button" disabled={loadingOlderMessages} onClick={onJumpToLatest}>
                      {labels.backToLatest}
                    </button>
                  )}
                </div>
              </div>
            )}

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
              <RuntimeIdentity
                runtime={runtime}
                localLabel={labels.localRuntime}
                worktreeLabel={labels.worktreeRuntime}
                compact
              />
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
