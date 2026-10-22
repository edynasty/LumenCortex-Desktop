import type { MCPAgentTool, MCPDefinedScope, MCPToolPermission } from "../../types";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import type { ExtensionsLabels } from "./extensions-types";

type Override = { permission?: MCPToolPermission };

type Props = {
  labels: ExtensionsLabels;
  /** The tools Core exposes for the selected server right now (empty while it is stopped). */
  tools: MCPAgentTool[];
  /** The saved overrides of the selected server entry, keyed by the server's tool name. */
  overrides: Record<string, Override>;
  /** The file the selected entry is defined in. */
  scope: MCPDefinedScope | undefined;
  /** The open workspace's trust, from the app's one trust source. */
  trusted: boolean;
  busy: boolean;
  onSetPermission: (toolName: string, permission: MCPToolPermission | null) => void;
};

/**
 * The selected server's tool permissions (ADR-0013). Each tool shows the permission Core exposes it
 * with and whether the server's annotation or a user override decided it; an override is written into
 * the file the server entry came from. A project override cannot take effect in an untrusted
 * workspace, so the pane says so instead of showing an override as if it were in force.
 */
export function MCPToolList({ labels, tools, overrides, scope, trusted, busy, onSetPermission }: Props) {
  const permissionLabels: Record<MCPToolPermission, string> = {
    read: labels.permissionRead,
    write: labels.permissionWrite,
    exec: labels.permissionExec,
  };
  // An entry without a permission is ignored by Core (effectivePermission), so it is not listed as
  // an override that does something.
  const overrideNames = Object.keys(overrides)
    .filter((name) => overrides[name].permission)
    .sort();
  const inactive = scope === "project" && !trusted;

  return (
    <>
      {overrideNames.length > 0 && (
        <>
          <h5 className="subhead">
            {labels.toolOverrides}
            <span className="muted"> · {overrideNames.length}</span>
          </h5>
          {inactive && (
            <p className="extensions-note" role="note">
              <Icon name="lock" size={13} />
              <span>{labels.overrideInactive}</span>
            </p>
          )}
          <ul className="setting-list">
            {overrideNames.map((name) => (
              <li key={name} className="setting-list-row">
                <span className="mono extensions-tool-name">{name}</span>
                <span className="badge mono">{permissionLabels[overrides[name].permission!]}</span>
                <span className="toolbar-spacer" />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSetPermission(name, null)}
                >
                  {labels.clearOverride}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h5 className="subhead">
        {labels.tools}
        <span className="muted"> · {tools.length}</span>
      </h5>
      {tools.length ? (
        <ul className="setting-list">
          {tools.map((tool) => (
            <li key={tool.name} className="setting-list-row">
              <span className="mono extensions-tool-name">{tool.toolName}</span>
              {tool.description && <span className="extensions-tool-desc">{tool.description}</span>}
              <span className="toolbar-spacer" />
              <span className={`badge ${tool.permission === "read" ? "" : "tone-warn"}`}>
                {permissionLabels[tool.permission]}
              </span>
              <span className="muted extensions-tool-source">
                {tool.permissionSource === "override"
                  ? labels.permissionFromOverride
                  : labels.permissionFromAnnotation}
              </span>
              {tool.permission !== "read" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSetPermission(tool.toolName, "read")}
                >
                  {labels.markReadOnly}
                </Button>
              )}
              {tool.permissionSource === "override" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSetPermission(tool.toolName, null)}
                >
                  {labels.clearOverride}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pane-intro">{labels.noTools}</p>
      )}
    </>
  );
}
