import type { SessionRuntime } from "../../types";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import type { ExtensionsLabels } from "./extensions-types";
import { MCPWorkspacePanel } from "./MCPWorkspacePanel";
import { SkillsPanel } from "./SkillsPanel";
import { ToolPermissionsPanel } from "./ToolPermissionsPanel";
import { useMCPWorkspaceController } from "./useMCPWorkspaceController";
import "./extensions.css";

export type ExtensionsTab = "mcp" | "skills" | "permissions";

type Props = {
  /** Which Settings pane shows this workspace's extensions. */
  tab: ExtensionsTab;
  workspace: string;
  sessionId: string;
  runtime: SessionRuntime;
  labels: ExtensionsLabels;
  onError: (message: string) => void;
};

export function ExtensionsWorkspace({ tab, workspace, sessionId, runtime, labels, onError }: Props) {
  const mcp = useMCPWorkspaceController({ workspace, sessionId, onError });

  return (
    <section className="extensions-workspace">
      <div className="extensions-runtime">
        <span>{labels.currentRuntime}</span>
        <RuntimeIdentity runtime={runtime} localLabel={labels.localRuntime} worktreeLabel={labels.worktreeRuntime} />
      </div>

      {tab === "mcp" ? (
        <MCPWorkspacePanel
          workspace={workspace}
          labels={labels}
          controller={mcp}
        />
      ) : tab === "skills" ? (
        <SkillsPanel
          workspace={workspace}
          onError={onError}
          labels={{
            title: labels.skills,
            add: labels.skillAdd,
            empty: labels.skillEmpty,
            globalScope: labels.globalScope,
            projectScope: labels.projectScope,
            globalHint: labels.skillGlobalHint,
            projectHint: labels.skillProjectHint,
            inherited: labels.inherited,
            globalSource: labels.globalSource,
            projectSource: labels.projectSource,
            enabled: labels.enabled,
            disabled: labels.disabled,
            id: labels.skillId,
            content: labels.skillContent,
            save: labels.save,
            delete: labels.delete,
            deleteTitle: labels.skillDeleteTitle,
            deleteBody: labels.skillDeleteBody,
            cancel: labels.cancel,
            error: labels.skillError,
          }}
        />
      ) : (
        <ToolPermissionsPanel
          workspace={workspace}
          mcpTools={mcp.tools}
          onError={onError}
          labels={{
            title: labels.permissions,
            description: labels.permissionsDescription,
            builtIn: labels.permissionsBuiltIn,
            language: labels.permissionsLanguage,
            subagents: labels.permissionsSubagents,
            mcp: labels.permissionsMCP,
            other: labels.permissionsOther,
            enabled: labels.enabled,
            disabled: labels.disabled,
            save: labels.save,
            empty: labels.permissionsEmpty,
          }}
        />
      )}
    </section>
  );
}
