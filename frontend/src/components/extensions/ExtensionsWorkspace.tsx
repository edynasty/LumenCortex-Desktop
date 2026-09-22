import { BookOpen, Server, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { SessionRuntime } from "../../types";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import type { ExtensionsLabels } from "./extensions-types";
import { MCPWorkspacePanel } from "./MCPWorkspacePanel";
import { SkillsPanel } from "./SkillsPanel";
import { ToolPermissionsPanel } from "./ToolPermissionsPanel";
import { useMCPWorkspaceController } from "./useMCPWorkspaceController";
import "./extensions.css";

type Props = {
  workspace: string;
  sessionId: string;
  runtime: SessionRuntime;
  labels: ExtensionsLabels;
  onError: (message: string) => void;
};

export function ExtensionsWorkspace({ workspace, sessionId, runtime, labels, onError }: Props) {
  const [tab, setTab] = useState<"mcp" | "skills" | "permissions">("mcp");
  const mcp = useMCPWorkspaceController({ workspace, sessionId, onError });

  return (
    <section className="extensions-workspace">
      <header className="extensions-header">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
          <div className="extensions-tabs" role="tablist" aria-label={labels.title}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "mcp"}
              className={tab === "mcp" ? "active" : ""}
              onClick={() => setTab("mcp")}
            >
              <Server size={12} strokeWidth={1.7} aria-hidden />
              {labels.mcpTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "skills"}
              className={tab === "skills" ? "active" : ""}
              onClick={() => setTab("skills")}
            >
              <BookOpen size={12} strokeWidth={1.7} aria-hidden />
              {labels.skillsTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "permissions"}
              className={tab === "permissions" ? "active" : ""}
              onClick={() => setTab("permissions")}
            >
              <ShieldCheck size={12} strokeWidth={1.7} aria-hidden />
              {labels.permissionsTab}
            </button>
          </div>
        </div>

        <div className="extensions-runtime">
          <span>{labels.currentRuntime}</span>
          <RuntimeIdentity
            runtime={runtime}
            localLabel={labels.localRuntime}
            worktreeLabel={labels.worktreeRuntime}
          />
        </div>
      </header>

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
