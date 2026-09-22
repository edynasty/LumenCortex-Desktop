import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { ExtensionsWorkspace } from "../components/extensions/ExtensionsWorkspace";
import { NewTaskComposer } from "../components/composer/NewTaskComposer";
import { ProviderSettingsPanel } from "../components/provider/ProviderSettingsPanel";
import { ReviewWorkspace } from "../components/review/ReviewWorkspace";
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
      <ExtensionsWorkspace
        workspace={workspace}
        sessionId={current?.id || route.sessionId || ""}
        runtime={runtime}
        onError={onError}
        labels={{
          title: labels.extensions,
          subtitle: labels.extensionsSubtitle,
          mcpServers: labels.mcpServers,
          addServer: labels.mcpAddServer,
          noServers: labels.mcpNoServers,
          serverId: labels.mcpServerId,
          serverName: labels.mcpServerName,
          command: labels.mcpCommand,
          args: labels.mcpArgs,
          protocol: labels.mcpProtocol,
          legacy: labels.mcpLegacy,
          modern: labels.mcpModern,
          save: labels.save,
          delete: labels.delete,
          deleteTitle: labels.mcpDeleteTitle,
          deleteBody: labels.mcpDeleteBody,
          cancel: labels.cancel,
          start: labels.mcpStart,
          stop: labels.mcpStop,
          refresh: labels.handoffRefresh,
          running: labels.lspRunning,
          stopped: labels.lspStopped,
          pid: labels.lspPid,
          pending: labels.lspPending,
          tools: labels.mcpTools,
          noTools: labels.mcpNoTools,
          readOnly: labels.readOnly,
          sideEffect: labels.mcpSideEffect,
          noAutoStart: labels.mcpNoAutoStart,
          currentRuntime: labels.currentRuntime,
          localRuntime: labels.localRuntime,
          worktreeRuntime: labels.worktreeRuntime,
          lastError: labels.lspLastError,
          selectServer: labels.mcpSelectServer,
          enabled: labels.enabled,
          disabled: labels.disabled,
          globalScope: labels.mcpGlobalScope,
          projectScope: labels.mcpProjectScope,
          globalScopeHint: labels.mcpGlobalScopeHint,
          projectScopeHint: labels.mcpProjectScopeHint,
          inherited: labels.mcpInherited,
          globalSource: labels.mcpGlobalSource,
          projectSource: labels.mcpProjectSource,
          mcpTab: labels.mcpTab,
          skillsTab: labels.skillsTab,
          permissionsTab: labels.permissionsTab,
          permissions: labels.permissions,
          permissionsDescription: labels.permissionsDescription,
          permissionsBuiltIn: labels.permissionsBuiltIn,
          permissionsLanguage: labels.permissionsLanguage,
          permissionsSubagents: labels.permissionsSubagents,
          permissionsMCP: labels.permissionsMCP,
          permissionsOther: labels.permissionsOther,
          permissionsEmpty: labels.permissionsEmpty,
          skills: labels.skills,
          skillAdd: labels.skillAdd,
          skillEmpty: labels.skillEmpty,
          skillGlobalHint: labels.skillGlobalHint,
          skillProjectHint: labels.skillProjectHint,
          skillId: labels.skillId,
          skillContent: labels.skillContent,
          skillDeleteTitle: labels.skillDeleteTitle,
          skillDeleteBody: labels.skillDeleteBody,
          skillError: labels.skillError,
        }}
      />
    );
  }

  if (route.kind === "review" && current) {
    return (
      <ReviewWorkspace
        sessionId={current.id}
        runtime={runtime}
        messages={messages}
        agentBusy={busy}
        agentRunning={running}
        onSendInstruction={onSendReviewInstruction}
        labels={{
          title: labels.review,
          changedFiles: labels.changedFiles,
          noChanges: labels.noChanges,
          unified: labels.unified,
          split: labels.split,
          worktree: labels.worktree,
          staged: labels.staged,
          stage: labels.stage,
          unstage: labels.unstage,
          revert: labels.revert,
          revertTitle: labels.revertTitle,
          revertBody: labels.revertBody,
          cancel: labels.cancel,
          commit: labels.commit,
          commitPlaceholder: labels.commitPlaceholder,
          push: labels.push,
          truncated: labels.diffTruncated,
          loading: labels.loading,
          binaryDiff: labels.binaryDiff,
          reviewInstruction: labels.reviewInstruction,
          reviewInstructionPlaceholder: labels.reviewInstructionPlaceholder,
          sendToAgent: labels.sendToAgent,
          agentRunning: labels.agentRunning,
          checks: labels.checks,
          checkPassed: labels.checkPassed,
          checkFailed: labels.checkFailed,
          checkTruncated: labels.checkTruncated,
          localRuntime: labels.localRuntime,
          worktreeRuntime: labels.worktreeRuntime,
          conflictTitle: labels.worktreeConflictTitle,
          conflictHint: labels.worktreeConflictHint,
          handoffTitle: labels.handoffTitle,
          handoffTarget: labels.handoffTarget,
          handoffCommits: labels.handoffCommits,
          handoffReady: labels.handoffReady,
          handoffSourceDirty: labels.handoffSourceDirty,
          handoffTargetDirty: labels.handoffTargetDirty,
          handoffNoCommits: labels.handoffNoCommits,
          handoffOverlap: labels.handoffOverlap,
          handoffApply: labels.handoffApply,
          handoffRefresh: labels.handoffRefresh,
          handoffConfirmTitle: labels.handoffConfirmTitle,
          handoffConfirmBody: labels.handoffConfirmBody,
          handoffApplied: labels.handoffApplied,
        }}
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
