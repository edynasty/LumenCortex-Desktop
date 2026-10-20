import type { FormEvent, ReactNode, Ref } from "react";
import { NewTaskComposer } from "../components/composer/NewTaskComposer";
import type { ComposerAgent, ComposerCopy } from "../components/composer/Composer";
import { agentName } from "./agent-catalog";
import { AgentsPage } from "../components/agents/AgentsPage";
import { ThreadWorkspace } from "../components/thread/ThreadWorkspace";
import type { AppCopy } from "../lib/i18n/app-copy";
import { ConfigWarnings } from "../components/config/ConfigWarnings";
import type {
  AgentEffort,
  AgentPolicy,
  ConfigState,
  Delegation,
  Message,
  RuntimeEvent,
  RuntimeKind,
  Session,
  SessionRuntime,
  SubagentNode,
  WorkflowSummary,
} from "../types";
import type { AgentCatalogController } from "./hooks/useAgentCatalog";
import { pickerPlaceholder, type ModelPickerOption } from "./model-selection";
import { isRunningElsewhere, kindLabel, sessionCause } from "../lib/session-status";
import { sessionStatusLabel, threadWorkspaceLabels } from "./presentation-model";
import { WorkspaceReviewRoute } from "./WorkspaceReviewRoute";
import { ThreadTasksLayer } from "./ThreadTasksLayer";
import type { WorkspaceRoute } from "./workspace-route";

type Policy = AgentPolicy;

type Props = {
  route: WorkspaceRoute;
  /** Source Control / Context page bodies, built by WorkspaceView. */
  pageContent?: ReactNode;
  current?: Session;
  runtime: SessionRuntime;
  labels: AppCopy;
  workspace: string;
  config: ConfigState;
  agents: AgentCatalogController;
  trusting: boolean;
  modelRef: string;
  pickerModels: ModelPickerOption[];
  recentModelRefs: string[];
  agent: ComposerAgent;
  effort?: AgentEffort;
  effortOptions: string[];
  contextPaths: string[];
  policy: Policy;
  runtimeKind: RuntimeKind;
  goal: string;
  busy: boolean;
  messages: Message[];
  messageAtLatest: boolean;
  messageLoadingOlder: boolean;
  running: boolean;
  workflowSummary: WorkflowSummary | null;
  subagents: SubagentNode[];
  textareaRef: Ref<HTMLTextAreaElement>;
  onTrustWorkspace: () => void;
  onModelChange: (value: string) => void;
  onEffortChange: (effort: AgentEffort | undefined) => void;
  onGoalChange: (value: string) => void;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  onPolicyChange: (value: Policy) => void;
  onRuntimeChange: (value: RuntimeKind) => void;
  onPickWorkspace: () => void;
  onOpenProviders: () => void;
  onApproveGate: (gateId: string) => void;
  onLoadOlderMessages: () => void;
  onJumpToLatest: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSendReviewInstruction: (path: string, instruction: string) => Promise<void>;
  // C3: the thread's runtime events, a Core re-read of the thread, opening a child thread and the
  // thread's delegation grant.
  events: RuntimeEvent[];
  onRefreshThread: (sessionId: string) => Promise<void>;
  onOpenSession: (sessionId: string) => void;
  onDelegationChange: (sessionId: string, delegation: Delegation) => void;
};

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

export function WorkspaceRouteContent({
  route,
  pageContent,
  current,
  runtime,
  labels,
  workspace,
  config,
  agents,
  trusting,
  modelRef,
  pickerModels,
  recentModelRefs,
  agent,
  effort,
  effortOptions,
  contextPaths,
  policy,
  runtimeKind,
  goal,
  busy,
  messages,
  messageAtLatest,
  messageLoadingOlder,
  running,
  workflowSummary,
  subagents,
  textareaRef,
  onTrustWorkspace,
  onModelChange,
  onEffortChange,
  onGoalChange,
  onPickContextFiles,
  onPickContextFolder,
  onRemoveContextPath,
  onPolicyChange,
  onRuntimeChange,
  onPickWorkspace,
  onOpenProviders,
  onApproveGate,
  onLoadOlderMessages,
  onJumpToLatest,
  onCancel,
  onRetry,
  onSubmit,
  onSendReviewInstruction,
  events,
  onRefreshThread,
  onOpenSession,
  onDelegationChange,
}: Props) {
  const composerModels = pickerModels.map((item) => ({
    ...item,
    value: item.ref,
    badge: item.missingSecret
      ? labels.missingProviderKey
      : item.isDefault
        ? labels.defaultModel
        : undefined,
    badgeTone: item.missingSecret ? "warning" as const : "default" as const,
  }));
  const modelPlaceholder: string = pickerPlaceholder(modelRef, pickerModels, labels);
  // A chosen model the session is not pinned to yet is sent on the next turn; mark it pending.
  const modelPending = Boolean(current && modelRef !== current.modelRef);
  const composerCopy: ComposerCopy = Object.assign({}, labels, { noModels: modelPlaceholder });

  const configNotice = <ConfigWarnings labels={labels} warnings={config.warnings} trusting={trusting} hideDefaultLimit onTrust={onTrustWorkspace} />;

  if (route.kind === "scm" || route.kind === "context") return <>{pageContent}</>;

  if (route.kind === "agents") {
    return (
      <AgentsPage
        labels={labels}
        agents={agents}
        models={composerModels}
        recentModelRefs={recentModelRefs}
        effortOptions={effortOptions}
        onOpenProviders={onOpenProviders}
      />
    );
  }

  if (route.kind === "review" && current) {
    return (
      <WorkspaceReviewRoute
        session={current}
        runtime={runtime}
        busy={busy}
        running={running}
        labels={labels}
        onSendInstruction={onSendReviewInstruction}
      />
    );
  }

  if (!current) {
    return (
      <NewTaskComposer
        title={workspace ? labels.newThreadTitle : labels.buildTitle}
        subtitle={labels.newThreadSubtitle}
        copy={composerCopy}
        workspace={workspace}
        workspaceName={workspace ? basename(workspace) : ""}
        modelRef={modelRef}
        models={composerModels}
        recentModelRefs={recentModelRefs}
        effort={effort}
        effortOptions={effortOptions}
        agent={agent}
        policy={policy}
        contextPaths={contextPaths}
        runtime={runtimeKind}
        notice={configNotice}
        goal={goal}
        busy={busy}
        textareaRef={textareaRef}
        onGoalChange={onGoalChange}
        onModelChange={onModelChange}
        onEffortChange={onEffortChange}
        onPickContextFiles={onPickContextFiles}
        onPickContextFolder={onPickContextFolder}
        onRemoveContextPath={onRemoveContextPath}
        onPolicyChange={onPolicyChange}
        onRuntimeChange={onRuntimeChange}
        onPickWorkspace={onPickWorkspace}
        onOpenProviders={onOpenProviders}
        onSubmit={onSubmit}
      />
    );
  }

  // kind is detail under the durable status; only statuses that carry a cause show it.
  const cause = sessionCause(current);
  const statusDetail =
    !running && cause?.kind && ["interrupted", "waiting_gate", "failed"].includes(current.status)
      ? kindLabel(labels, cause.kind)
      : "";

  const threadAgent = agent.agents.find((entry) => entry.id === agent.selectedId);
  return (
    <ThreadTasksLayer
      key={current.id}
      session={current}
      events={events}
      subagents={subagents}
      messages={messages}
      running={running}
      busy={busy}
      labels={labels}
      onRefreshThread={onRefreshThread}
      onOpenSession={onOpenSession}
      onDelegationChange={onDelegationChange}
      delegationCeiling={threadAgent?.delegation ?? "isolated"}
      delegationCappedReason={threadAgent ? labels.agentCapsControls.replace("{agent}", agentName(threadAgent, labels)) : undefined}
    >
      {(extras) => (
        <ThreadWorkspace
          {...extras}
          session={current}
          runtime={runtime}
          messages={messages}
          hasOlderMessages={messages.length > 0 && messages[0].seq > 0}
          historicalMessages={!messageAtLatest}
          loadingOlderMessages={messageLoadingOlder}
          running={running}
          statusLabel={sessionStatusLabel(labels, current.status, running)}
          statusDetail={statusDetail}
          runningElsewhere={isRunningElsewhere(current.status, running)}
          workspaceName={basename(workspace)}
          workspacePath={workspace}
          modelRef={modelRef}
          models={composerModels}
          modelPending={modelPending}
          recentModelRefs={recentModelRefs}
          onOpenProviders={onOpenProviders}
          effort={effort}
          effortOptions={effortOptions}
          agent={agent}
          policy={policy}
          onPolicyChange={onPolicyChange}
          onEffortChange={onEffortChange}
          onPickContextFiles={onPickContextFiles}
          onPickContextFolder={onPickContextFolder}
          onRemoveContextPath={onRemoveContextPath}
          contextPaths={contextPaths}
          notice={configNotice}
          goal={goal}
          busy={busy}
          workflowSummary={workflowSummary}
          activeSubagents={subagents.filter((node) => node.active).length}
          textareaRef={textareaRef}
          labels={threadWorkspaceLabels(labels, modelPlaceholder)}
          composerLabels={composerCopy}
          onGoalChange={onGoalChange}
          onModelChange={onModelChange}
          onApproveGate={onApproveGate}
          onLoadOlderMessages={onLoadOlderMessages}
          onJumpToLatest={onJumpToLatest}
          onCancel={onCancel}
          onRetry={onRetry}
          onSubmit={onSubmit}
        />
      )}
    </ThreadTasksLayer>
  );
}
