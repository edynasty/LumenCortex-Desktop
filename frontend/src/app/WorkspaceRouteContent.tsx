import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { NewTaskComposer } from "../components/composer/NewTaskComposer";
import { ProviderSettingsPanel } from "../components/provider/ProviderSettingsPanel";
import { ThreadWorkspace } from "../components/thread/ThreadWorkspace";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import type {
  Message,
  ProviderCatalog,
  RuntimeKind,
  Session,
  SessionRuntime,
  SubagentNode,
  WorkflowSummary,
} from "../types";
import type { ConfiguredModelOption } from "./presentation-model";
import { sessionStatusLabel } from "./presentation-model";
import { WorkspaceExtensionsRoute } from "./WorkspaceExtensionsRoute";
import { WorkspaceReviewRoute } from "./WorkspaceReviewRoute";
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
  catalog: ProviderCatalog;
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
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onCatalogChange: (catalog: ProviderCatalog) => void;
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
  catalog,
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
  onCatalogChange,
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
}: Props) {
  const modelSelectOptions = configuredModels.map((item) => ({
    value: item.ref,
    label: item.label,
    description: item.description,
    group: item.group,
  }));

  if (route.kind === "providers") {
    return (
      <ProviderSettingsPanel
        locale={locale}
        workspace={workspace}
        effectiveCatalog={catalog}
        selectedModelRef={modelRef}
        onSelectedModelRef={onModelChange}
        onEffectiveCatalogChange={onCatalogChange}
        onError={onError}
      />
    );
  }

  if (route.kind === "extensions") {
    return (
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
    return (
      <WorkspaceReviewRoute
        session={current}
        runtime={runtime}
        messages={messages}
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
        title={labels.buildTitle}
        subtitle={labels.newTaskSubtitle}
        placeholder={labels.composerPlaceholder}
        workspace={workspace}
        workspaceName={workspace ? basename(workspace) : ""}
        recentProjects={recentProjects}
        recentProjectsLabel={labels.recentProjects}
        chooseProjectLabel={labels.openProject}
        modelLabel={labels.modelSelect}
        modelRef={modelRef}
        models={configuredModels}
        noModelsLabel={labels.modelFallback}
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

  return (
    <ThreadWorkspace
      session={current}
      runtime={runtime}
      messages={messages}
      hasOlderMessages={messages.length > 0 && messages[0].seq > 0}
      historicalMessages={!messageAtLatest}
      loadingOlderMessages={messageLoadingOlder}
      running={running}
      statusLabel={sessionStatusLabel(labels, current.status, running)}
      workspaceName={basename(workspace)}
      modelRef={modelRef}
      models={modelSelectOptions}
      policyLabel={policy === "read-only" ? labels.readOnly : policy === "full" ? labels.full : labels.workspace}
      goal={goal}
      busy={busy}
      workflowSummary={workflowSummary}
      activeSubagents={subagents.filter((node) => node.active).length}
      textareaRef={textareaRef}
      labels={{
        newTask: labels.newTask,
        running: labels.running,
        noMessages: labels.noMessages,
        finalAnswer: labels.finalAnswer,
        startAnother: labels.startAnother,
        composerPlaceholder: labels.composerPlaceholder,
        composerHint: labels.composerHint,
        noModels: labels.noModels,
        start: labels.start,
        roleUser: labels.messageRoleUser,
        roleAssistant: labels.messageRoleAssistant,
        roleTool: labels.messageRoleTool,
        roleSystem: labels.messageRoleSystem,
        approvalTitle: labels.approvalTitle,
        approve: labels.approve,
        loadEarlier: labels.loadEarlier,
        backToLatest: labels.backToLatest,
        historyWindow: labels.historyWindow,
        localRuntime: labels.localRuntime,
        worktreeRuntime: labels.worktreeRuntime,
        plan: labels.plan,
        planRunning: labels.planRunning,
        planWaiting: labels.planWaiting,
        planSubagents: labels.planSubagents,
        copy: labels.copy,
        copied: labels.copied,
        retry: labels.retry,
      }}
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
  );
}
