import { useEffect, useRef } from "react";
import type {
  FormEvent,
  ReactNode,
  Ref,
} from "react";
import type { AgentEffort, Message, Session, SessionRuntime, WorkflowSummary } from "../../types";
import type { AgentMode, AgentPolicy } from "../../app/agent-config";
import type { ComposerCopy } from "../composer/Composer";
import type { PickerOption } from "../composer/ComposerPickers";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import { EmptyState } from "../primitives/EmptyState";
import { LoadingState } from "../primitives/LoadingState";
import { Icon } from "../primitives/Icon";
import { ApprovalCard } from "./ApprovalCard";
import { MessageItem } from "./MessageItem";
import { ThreadOutcome } from "./ThreadOutcome";
import { ThreadProgress } from "./ThreadProgress";
import { ThreadComposer } from "./ThreadComposer";
import { WorkGroup } from "./WorkGroup";

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
  models: PickerOption[];
  modelPending?: boolean;
  recentModelRefs: string[];
  onOpenProviders: () => void;
  effort?: AgentEffort;
  effortOptions: string[];
  mode: AgentMode;
  policy: AgentPolicy;
  onModeChange: (mode: AgentMode) => void;
  onPolicyChange: (policy: AgentPolicy) => void;
  onEffortChange: (effort: AgentEffort | undefined) => void;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  contextPaths: string[];
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
    newTask: string; running: string;
    noMessages: string; finalAnswer: string;
    start: string;
    roleUser: string; roleAssistant: string;
    roleTool: string; roleSystem: string;
    approvalTitle: string; approve: string;
    loadEarlier: string; backToLatest: string; historyWindow: string;
    localRuntime: string; worktreeRuntime: string;
    plan: string;
    planRunning: string; planWaiting: string; planSubagents: string;
    copy: string; copied: string;
    retry: string; failureTitle: string;
    workTitle: string; workCalls: string;
    showOutput: string; hideOutput: string;
    runningElsewhereNotice: string; runtimeNotice: string;
    originToolInterrupted: string; originToolInterruptedBody: string;
    originCompletionBlocked: string; originResume: string; originTurn: string;
  };
  // The composer's own copy (app copy + the config-dependent picker placeholder).
  composerLabels: ComposerCopy;
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApproveGate: (gateId: string) => void;
  onLoadOlderMessages: () => void;
  onJumpToLatest: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type Entry = { kind: "message"; message: Message } | { kind: "work"; messages: Message[]; live: boolean };

function messageOrigin(message: Message): string {
  const value = message.json;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const origin = (value as Record<string, unknown>).origin;
    if (typeof origin === "string") return origin;
  }
  return "";
}

// Consecutive tool calls without an origin fold into one work group. The group that ends the
// transcript while the run is live stays open and carries the running indicator.
function groupEntries(messages: Message[], running: boolean, overrides: Map<Message, ReactNode>): Entry[] {
  const entries: Entry[] = [];
  let work: Message[] = [];
  const flush = (live: boolean) => {
    if (work.length) entries.push({ kind: "work", messages: work, live });
    work = [];
  };
  for (const message of messages) {
    const isWork = message.role === "tool" && !messageOrigin(message) && !overrides.has(message);
    if (isWork) {
      work.push(message);
      continue;
    }
    flush(false);
    entries.push({ kind: "message", message });
  }
  flush(running);
  return entries;
}

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
  modelPending,
  recentModelRefs,
  onOpenProviders,
  effort,
  effortOptions,
  mode,
  policy,
  onModeChange,
  onPolicyChange,
  onEffortChange,
  onPickContextFiles,
  onPickContextFolder,
  onRemoveContextPath,
  contextPaths,
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
  composerLabels,
  onGoalChange,
  onModelChange,
  onApproveGate,
  onLoadOlderMessages,
  onJumpToLatest,
  onCancel,
  onRetry,
  onSubmit,
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

  // Rows the layer presents itself (task_result) are rendered by their own components.
  const overrides = new Map<Message, ReactNode>();
  for (const message of messages) {
    if (renderRuntimeRow) {
      const row = renderRuntimeRow(message);
      if (row) overrides.set(message, row);
    }
  }
  const entries = groupEntries(messages, running, overrides);

  return (
    <div className="thread-view">
      <div
        className="ledger-scroll"
        ref={threadViewRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        }}
      >
        <div className="ledger">
          <section className="task-intro">
            <div className="task-intro-copy">
              <h1>{session.goal}</h1>
              <div className="task-meta">
                <span className={`status-pill ${running ? "running" : session.status}`}>{statusLabel}</span>
                {resolution && (
                  <span className={`resolution-pill view-${resolution.tone}`} title={resolution.title}>{resolution.label}</span>
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

          {runningElsewhere && <p className="notice-line tone-info" role="status"><Icon name="local" size={14} />{labels.runningElsewhereNotice}</p>}

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
                    <button type="button" className="btn btn-ghost btn-sm" disabled={loadingOlderMessages} onClick={onLoadOlderMessages}>
                      {labels.loadEarlier}
                    </button>
                  )}
                  {historicalMessages && (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={loadingOlderMessages} onClick={onJumpToLatest}>
                      {labels.backToLatest}
                    </button>
                  )}
                </div>
              </div>
            )}

            {entries.map((entry) =>
              entry.kind === "work" ? (
                <WorkGroup
                  key={`work-${entry.messages[0].seq}`}
                  messages={entry.messages}
                  live={entry.live}
                  labels={labels}
                />
              ) : (
                overrides.get(entry.message) ?? (
                  <MessageItem
                    key={`${entry.message.seq}-${entry.message.role}`}
                    message={entry.message}
                    labels={labels}
                  />
                )
              ),
            )}

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

          <ThreadOutcome
            session={session}
            running={running}
            busy={busy}
            settled={resolution?.tone === "done"}
            failureHeadline={statusDetail || statusLabel}
            labels={labels}
            onRetry={onRetry}
          />
        </div>
      </div>

      <ThreadComposer
        runtime={runtime}
        copy={composerLabels}
        modelRef={modelRef}
        models={models}
        modelPending={modelPending}
        recentModelRefs={recentModelRefs}
        onOpenProviders={onOpenProviders}
        effort={effort}
        effortOptions={effortOptions}
        mode={mode}
        policy={policy}
        delegationControl={delegationControl}
        contextPaths={contextPaths}
        goal={goal}
        running={running}
        busy={busy}
        textareaRef={textareaRef}
        onGoalChange={onGoalChange}
        onModelChange={onModelChange}
        onModeChange={onModeChange}
        onPolicyChange={onPolicyChange}
        onEffortChange={onEffortChange}
        onPickContextFiles={onPickContextFiles}
        onPickContextFolder={onPickContextFolder}
        onRemoveContextPath={onRemoveContextPath}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </div>
  );
}
