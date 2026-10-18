import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode, Ref } from "react";
import { NewTaskComposer } from "../components/composer/NewTaskComposer";
import { ProviderSettingsPanel } from "../components/provider/ProviderSettingsPanel";
import { ThreadWorkspace } from "../components/thread/ThreadWorkspace";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import { ConfigWarnings } from "../components/config/ConfigWarnings";
import type {
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
import { pickerPlaceholder, type ConfiguredModelOption } from "./model-selection";
import { isRunningElsewhere, kindLabel, sessionCause } from "../lib/session-status";
import { sessionStatusLabel, threadWorkspaceLabels } from "./presentation-model";
import { WorkspaceExtensionsRoute } from "./WorkspaceExtensionsRoute";
import { WorkspaceReviewRoute } from "./WorkspaceReviewRoute";
import { ThreadTasksLayer } from "./ThreadTasksLayer";
import type { WorkspaceRoute } from "./workspace-route";

type Policy = "read-only" | "workspace" | "full";

type Props = {
  route: WorkspaceRoute;
  current?: Session;
  runtime: SessionRuntime;
  locale: Locale;
  labels: AppCopy;
  workspace: string;
  recentProjects: string[];
  config: ConfigState;
  trusting: boolean;
  modelRef: string;
  configuredModels: ConfiguredModelOption[];
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
  onConfigChanged: () => void;
  onTrustWorkspace: () => void;
  onModelChange: (value: string) => void;
  onError: (message: string) => void;
  onGoalChange: (value: string) => void;
  onPickContextFiles: () => void;
  onPickContextFolder: () => void;
  onRemoveContextPath: (path: string) => void;
  onPolicyChange: (value: Policy) => void;
  onRuntimeChange: (value: RuntimeKind) => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onOpenProviders: () => void;
  onApproveGate: (gateId: string) => void;
  onLoadOlderMessages: () => void;
  onJumpToLatest: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
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
  current,
  runtime,
  locale,
  labels,
  workspace,
  recentProjects,
  config,
  trusting,
  modelRef,
  configuredModels,
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
  onConfigChanged,
  onTrustWorkspace,
  onModelChange,
  onError,
  onGoalChange,
  onPickContextFiles,
  onPickContextFolder,
  onRemoveContextPath,
  onPolicyChange,
  onRuntimeChange,
  onPickWorkspace,
  onOpenWorkspace,
  onOpenProviders,
  onApproveGate,
  onLoadOlderMessages,
  onJumpToLatest,
  onCancel,
  onRetry,
  onSubmit,
  onKeyDown,
  onSendReviewInstruction,
  events,
  onRefreshThread,
  onOpenSession,
  onDelegationChange,
}: Props) {
  const composerModels = configuredModels.map((item) => ({
    ...item,
    badge: item.missingSecret
      ? labels.missingProviderKey
      : item.isDefault
        ? labels.defaultModel
        : undefined,
    badgeTone: item.missingSecret ? "warning" as const : "default" as const,
  }));
  const modelSelectOptions = composerModels.map((item) => ({
    value: item.ref,
    label: item.label,
    description: item.description,
    group: item.group,
    badge: item.badge,
    badgeTone: item.badgeTone,
  }));
  const modelPlaceholder = pickerPlaceholder(modelRef, configuredModels, labels);

  const configNotice = <ConfigWarnings labels={labels} warnings={config.warnings} trusting={trusting} hideDefaultLimit onTrust={onTrustWorkspace} />;

  const providerActive = route.kind === "providers";
  const [providerMounted, setProviderMounted] = useState(providerActive);

  useEffect(() => {
    if (providerActive) setProviderMounted(true);
  }, [providerActive]);

  const providerLayer = providerMounted || providerActive ? (
    <div className="workspace-route-keepalive" hidden={!providerActive}>
      <ProviderSettingsPanel
        locale={locale}
        workspace={workspace}
        config={config}
        trusting={trusting}
        onTrust={onTrustWorkspace}
        onConfigChanged={onConfigChanged}
        onError={onError}
      />
    </div>
  ) : null;

  const withProviderLayer = (content: ReactNode) => (
    <>
      {providerLayer}
      {content}
    </>
  );

  if (providerActive) return providerLayer;

  if (route.kind === "extensions") {
    return withProviderLayer(
      <WorkspaceExtensionsRoute
        workspace={workspace}
        sessionId={current?.id || route.sessionId || ""}
        runtime={runtime}
        labels={labels}
        onError={onError}
      />
    );
  }

  if (route.kind === "review" && current) {
    return withProviderLayer(
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
    return withProviderLayer(
      <NewTaskComposer
        title={labels.buildTitle}
        subtitle={labels.newTaskSubtitle}
        placeholder={labels.composerPlaceholder}
        workspace={workspace}
        workspaceName={workspace ? basename(workspace) : ""}
        recentProjects={recentProjects}
        recentProjectsLabel={labels.recentProjects}
        chooseProjectLabel={labels.openProject}
        modelLabel={labels.modelSelect}
        modelSearchLabel={labels.modelSearch}
        noModelMatchesLabel={labels.noModelMatches}
        modelRef={modelRef}
        models={composerModels}
        noModelsLabel={modelPlaceholder}
        contextPaths={contextPaths}
        contextLabels={{
          context: labels.context,
          files: labels.attachFiles,
          folder: labels.attachFolder,
          remove: labels.removeContext,
        }}
        policyLabel={labels.policy}
        policy={policy}
        policyLabels={{
          "read-only": labels.readOnly,
          workspace: labels.workspace,
          full: labels.full,
        }}
        policyDescriptions={{
          "read-only": labels.readOnlyDescription,
          workspace: labels.workspaceDescription,
          full: labels.fullDescription,
        }}
        environmentLabel={labels.environment}
        runtime={runtimeKind}
        runtimeLabels={{
          local: labels.localRuntime,
          worktree: labels.worktreeRuntime,
        }}
        runtimeDescriptions={{
          local: labels.localRuntimeDescription,
          worktree: labels.worktreeRuntimeDescription,
        }}
        hint={labels.composerHint}
        startLabel={labels.start}
        notice={configNotice}
        goal={goal}
        busy={busy}
        textareaRef={textareaRef}
        onGoalChange={onGoalChange}
        onModelChange={onModelChange}
        onPickContextFiles={onPickContextFiles}
        onPickContextFolder={onPickContextFolder}
        onRemoveContextPath={onRemoveContextPath}
        onPolicyChange={onPolicyChange}
        onRuntimeChange={onRuntimeChange}
        onPickWorkspace={onPickWorkspace}
        onOpenWorkspace={onOpenWorkspace}
        onOpenProviders={onOpenProviders}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
      />
    );
  }

  // kind is detail under the durable status; only statuses that carry a cause show it.
  const cause = sessionCause(current);
  const statusDetail =
    !running && cause?.kind && ["interrupted", "waiting_gate", "failed"].includes(current.status)
      ? kindLabel(labels, cause.kind)
      : "";

  return withProviderLayer(
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
          modelRef={modelRef}
          models={modelSelectOptions}
          policyLabel={policy === "read-only" ? labels.readOnly : policy === "full" ? labels.full : labels.workspace}
          notice={configNotice}
          goal={goal}
          busy={busy}
          workflowSummary={workflowSummary}
          activeSubagents={subagents.filter((node) => node.active).length}
          textareaRef={textareaRef}
          labels={threadWorkspaceLabels(labels, modelPlaceholder)}
          onGoalChange={onGoalChange}
          onModelChange={onModelChange}
          onApproveGate={onApproveGate}
          onLoadOlderMessages={onLoadOlderMessages}
          onJumpToLatest={onJumpToLatest}
          onCancel={onCancel}
          onRetry={onRetry}
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
        />
      )}
    </ThreadTasksLayer>
  );
}
