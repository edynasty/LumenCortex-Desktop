import { useEffect, useRef, useState } from "react";
import type {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import { Check, CircleCheck, Copy, RotateCcw } from "lucide-react";
import { copyText } from "../../lib/clipboard";
import type { Message, Session, SessionRuntime, WorkflowSummary } from "../../types";
import type { SelectOption } from "../primitives/Select";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import { EmptyState } from "../primitives/EmptyState";
import { LoadingState } from "../primitives/LoadingState";
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
  statusDetail: string;
  runningElsewhere: boolean;
  workspaceName: string;
  modelRef: string;
  models: SelectOption[];
  policyLabel: string;
  notice?: ReactNode;
  // The thread's resolution from Task State (ADR-0006 D2), independent of the run status: a turn that
  // ended is not a done objective. Absent until Core's view is read.
  resolution?: { label: string; tone: "open" | "review" | "done" | "dropped"; title: string };
  // The execution task cards (C3) and the delegation control in the composer.
  tasks?: ReactNode;
  delegationControl?: ReactNode;
  // Renders a runtime row the thread presents itself (task_result); null keeps the default row.
  renderRuntimeRow?: (message: Message) => ReactNode | null;
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
    modelSearch: string;
    noModelMatches: string;
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
    runningElsewhereNotice: string;
    runtimeNotice: string;
    originToolInterrupted: string;
    originToolInterruptedBody: string;
    originCompletionBlocked: string;
    originResume: string;
    originTurn: string;
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
  statusDetail,
  runningElsewhere,
  workspaceName,
  modelRef,
  models,
  policyLabel,
  notice,
  resolution,
  tasks,
  delegationControl,
  renderRuntimeRow,
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
                {resolution && (
                  <span className={`resolution-pill ${resolution.tone}`} title={resolution.title}>{resolution.label}</span>
                )}
                {statusDetail && <span>{statusDetail}</span>}
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

          {notice}

          {runningElsewhere && <p className="thread-notice" role="status">{labels.runningElsewhereNotice}</p>}

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

            {messages.map((message) => renderRuntimeRow?.(message) ?? (
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
                  runtimeNotice: labels.runtimeNotice,
                  originToolInterrupted: labels.originToolInterrupted,
                  originToolInterruptedBody: labels.originToolInterruptedBody,
                  originCompletionBlocked: labels.originCompletionBlocked,
                  originResume: labels.originResume,
                  originTurn: labels.originTurn,
                }}
              />
            ))}

            {!messages.length && (
              running
                ? <LoadingState compact label={labels.running} />
                : <EmptyState compact title={labels.noMessages} />
            )}
          </section>

          {tasks}

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
            <section className={`final-result${resolution?.tone === "done" ? " settled" : ""}`}>
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

          {!running && (session.status === "interrupted" || session.status === "failed") && (
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
        delegationControl={delegationControl}
        goal={goal}
        running={running}
        busy={busy}
        textareaRef={textareaRef}
        labels={{
          startAnother: labels.startAnother,
          composerHint: labels.composerHint,
          noModels: labels.noModels,
          modelSearch: labels.modelSearch,
          noModelMatches: labels.noModelMatches,
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
