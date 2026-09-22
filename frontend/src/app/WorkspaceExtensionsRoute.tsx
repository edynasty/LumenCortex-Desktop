import { ExtensionsWorkspace } from "../components/extensions/ExtensionsWorkspace";
import type { AppCopy } from "../lib/i18n/app-copy";
import type { SessionRuntime } from "../types";

type Props = {
  workspace: string;
  sessionId: string;
  runtime: SessionRuntime;
  labels: AppCopy;
  onError: (message: string) => void;
};

export function WorkspaceExtensionsRoute({
  workspace,
  sessionId,
  runtime,
  labels,
  onError,
}: Props) {
  return (
    <ExtensionsWorkspace
      workspace={workspace}
      sessionId={sessionId}
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
