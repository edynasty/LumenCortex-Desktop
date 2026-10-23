import type { SessionRuntime } from "../../types";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import { skillLabels } from "../settings/extensions-labels";
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
  /** The open workspace's trust, from the app's one trust source (ConfigState.trusted). */
  trusted: boolean;
  trusting: boolean;
  onTrust: () => void;
  labels: ExtensionsLabels;
  onError: (message: string) => void;
};

export function ExtensionsWorkspace({
  tab,
  workspace,
  sessionId,
  runtime,
  trusted,
  trusting,
  onTrust,
  labels,
  onError,
}: Props) {
  const mcp = useMCPWorkspaceController({ workspace, sessionId, trusted, onError });

  return (
    <section className="pane">
      <p className="extensions-runtime">
        <span>{labels.currentRuntime}</span>
        <RuntimeIdentity runtime={runtime} localLabel={labels.localRuntime} worktreeLabel={labels.worktreeRuntime} />
      </p>

      {tab === "mcp" ? (
        <MCPWorkspacePanel
          workspace={workspace}
          labels={labels}
          controller={mcp}
          trusted={trusted}
          trusting={trusting}
          onTrust={onTrust}
        />
      ) : tab === "skills" ? (
        <SkillsPanel
          workspace={workspace}
          trusted={trusted}
          labels={skillLabels(labels)}
          onError={onError}
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
