import { useEffect, useRef, useState } from "react";
import type {
  FormEvent,
  KeyboardEvent,
  Ref,
} from "react";
import { Check, CircleCheck, Copy, RotateCcw } from "lucide-react";
import { copyText } from "../../lib/clipboard";
import type { Message, Session, SessionRuntime, WorkflowSummary } from "../../types";
import type { SelectOption } from "../primitives/Select";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import { ApprovalCard } from "./ApprovalCard";
import { Markdown } from "./Markdown";
import { MessageItem } from "./MessageItem";
import { ThreadProgress } from "./ThreadProgress";
import { ThreadComposer } from "./ThreadComposer";

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
    copy: string;
    copied: string;
    retry: string;
  };
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApproveGate: (gateId: string) => void;
  onLoadOlderMessages: () => void;
  onJumpToLatest: () => void;
  onCancel: () => void;
  onRetry: () => void;
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
  onRetry,
  onSubmit,
  onKeyDown,
}: Props) {
  const threadViewRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const [finalCopied, setFinalCopied] = useState(false);

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
                  copy: labels.copy,
                  copied: labels.copied,
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
                <span>
                  <CircleCheck size={14} strokeWidth={1.7} aria-hidden />
                  {labels.finalAnswer}
                </span>
                <button
                  type="button"
                  className="thread-inline-action"
                  onClick={async () => {
                    if (await copyText(session.final || "")) {
                      setFinalCopied(true);
                      window.setTimeout(() => setFinalCopied(false), 1200);
                    }
                  }}
                >
                  {finalCopied ? <Check size={11} strokeWidth={1.8} aria-hidden /> : <Copy size={11} strokeWidth={1.7} aria-hidden />}
                  {finalCopied ? labels.copied : labels.copy}
                </button>
              </div>
              <Markdown text={session.final} />
            </section>
          )}

          {!running && (session.status === "interrupted" || Boolean(session.error)) && (
            <div className="thread-retry-row">
              <button type="button" disabled={busy} onClick={onRetry}>
                <RotateCcw size={12} strokeWidth={1.7} aria-hidden />
                {labels.retry}
              </button>
            </div>
          )}
        </div>
      </div>

      <ThreadComposer
        runtime={runtime}
        workspaceName={workspaceName}
        modelRef={modelRef}
        models={models}
        policyLabel={policyLabel}
        goal={goal}
        running={running}
        busy={busy}
        textareaRef={textareaRef}
        labels={{
          startAnother: labels.startAnother,
          composerHint: labels.composerHint,
          noModels: labels.noModels,
          start: labels.start,
          running: labels.running,
          localRuntime: labels.localRuntime,
          worktreeRuntime: labels.worktreeRuntime,
        }}
        onGoalChange={onGoalChange}
        onModelChange={onModelChange}
        onCancel={onCancel}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
      />
    </>
  );
}
