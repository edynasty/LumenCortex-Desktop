import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { MCPAgentTool, ToolPermissions } from "../../types";
import { Button } from "../primitives/Button";
import { EmptyState } from "../primitives/EmptyState";

type Labels = {
  title: string;
  description: string;
  builtIn: string;
  language: string;
  subagents: string;
  mcp: string;
  other: string;
  enabled: string;
  disabled: string;
  save: string;
  empty: string;
};

type Props = {
  workspace: string;
  mcpTools: MCPAgentTool[];
  labels: Labels;
  onError: (message: string) => void;
};

type ToolEntry = {
  name: string;
  description: string;
  category: "built-in" | "language" | "subagents" | "mcp" | "other";
};

const builtIns: ToolEntry[] = [
  ["search_text", "Search repository text", "built-in"],
  ["find_files", "Find repository files", "built-in"],
  ["git_status", "Read Git status", "built-in"],
  ["git_diff", "Read Git diff", "built-in"],
  ["read_file", "Read workspace files", "built-in"],
  ["list_dir", "List workspace directories", "built-in"],
  ["write_file", "Create or replace files", "built-in"],
  ["replace_in_file", "Replace exact text in files", "built-in"],
  ["apply_patch", "Apply atomic file patches", "built-in"],
  ["shell", "Run shell commands", "built-in"],
].map(([name, description, category]) => ({ name, description, category: category as ToolEntry["category"] }));

const languageTools: ToolEntry[] = [
  ["lsp_hover", "Language hover/type information"],
  ["lsp_definition", "Find definitions"],
  ["lsp_references", "Find references"],
  ["lsp_document_symbols", "Document symbols"],
  ["lsp_workspace_symbols", "Workspace symbols"],
  ["lsp_diagnostics", "Language diagnostics"],
  ["lsp_rename", "Preview symbol rename edits"],
].map(([name, description]) => ({ name, description, category: "language" as const }));

const subagentTools: ToolEntry[] = [
  ["spawn_subagent", "Spawn a bounded read-only child agent"],
  ["list_subagents", "List child agents"],
  ["wait_subagent", "Wait for a child agent result"],
].map(([name, description]) => ({ name, description, category: "subagents" as const }));

export function ToolPermissionsPanel({ workspace, mcpTools, labels, onError }: Props) {
  const [permissions, setPermissions] = useState<ToolPermissions>({ disabled: [] });
  const [saved, setSaved] = useState<ToolPermissions>({ disabled: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workspace) {
      setPermissions({ disabled: [] });
      setSaved({ disabled: [] });
      return;
    }
    let cancelled = false;
    bridge.toolPermissions()
      .then((value) => {
        if (!cancelled) {
          setPermissions(value);
          setSaved(value);
        }
      })
      .catch((err) => {
        if (!cancelled) onError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [onError, workspace]);

  const entries = useMemo(() => {
    const map = new Map<string, ToolEntry>();
    for (const entry of [...builtIns, ...languageTools, ...subagentTools]) map.set(entry.name, entry);
    for (const tool of mcpTools) {
      map.set(tool.name, {
        name: tool.name,
        description: tool.description || tool.toolName,
        category: "mcp",
      });
    }
    for (const name of permissions.disabled) {
      if (!map.has(name)) {
        map.set(name, { name, description: name, category: "other" });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
    );
  }, [mcpTools, permissions.disabled]);

  const disabled = useMemo(() => new Set(permissions.disabled), [permissions.disabled]);
  const dirty = useMemo(() => {
    const left = [...permissions.disabled].sort().join("\n");
    const right = [...saved.disabled].sort().join("\n");
    return left !== right;
  }, [permissions.disabled, saved.disabled]);

  function toggle(name: string) {
    setPermissions((current) => {
      const next = new Set(current.disabled);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { disabled: Array.from(next).sort() };
    });
  }

  async function save() {
    if (!workspace || busy || !dirty) return;
    setBusy(true);
    try {
      const next = await bridge.saveToolPermissions(permissions);
      setPermissions(next);
      setSaved(next);
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const categories: Array<[ToolEntry["category"], string]> = [
    ["built-in", labels.builtIn],
    ["language", labels.language],
    ["subagents", labels.subagents],
    ["mcp", labels.mcp],
    ["other", labels.other],
  ];

  return (
    <div className="tool-permissions-panel">
      <header className="tool-permissions-head">
        <div>
          <strong>{labels.title}</strong>
          <p>{labels.description}</p>
        </div>
        <Button variant="primary" disabled={busy || !dirty} onClick={() => void save()}>
          {labels.save}
        </Button>
      </header>

      {!entries.length ? (
        <EmptyState icon={<ShieldCheck size={20} />} title={labels.empty} />
      ) : (
        <div className="tool-permission-groups">
          {categories.map(([category, title]) => {
            const items = entries.filter((entry) => entry.category === category);
            if (!items.length) return null;
            return (
              <section className="tool-permission-group" key={category}>
                <div className="tool-permission-group-title">
                  <strong>{title}</strong>
                  <span>{items.length}</span>
                </div>
                <div className="tool-permission-list">
                  {items.map((entry) => {
                    const isDisabled = disabled.has(entry.name);
                    return (
                      <button
                        type="button"
                        className={"tool-permission-row " + (isDisabled ? "disabled" : "enabled")}
                        key={entry.name}
                        aria-pressed={!isDisabled}
                        onClick={() => toggle(entry.name)}
                      >
                        <span className="tool-permission-toggle"><span /></span>
                        <span className="tool-permission-copy">
                          <code>{entry.name}</code>
                          <small>{entry.description}</small>
                        </span>
                        <strong>{isDisabled ? labels.disabled : labels.enabled}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
