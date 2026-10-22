import type { SubagentNode } from "../../types";
import { Icon } from "../primitives/Icon";
import { InspectorSection } from "./Section";

type Props = {
  nodes: SubagentNode[];
  labels: {
    title: string;
    empty: string;
    active: string;
    completed: string;
    interrupted: string;
    imported: string;
  };
  onOpenSession: (sessionId: string) => void;
};

function statusLabel(node: SubagentNode, labels: Props["labels"]) {
  if (node.active) return labels.active;
  if (node.status === "completed") return labels.completed;
  if (node.status === "interrupted") return labels.interrupted;
  return node.status;
}

function TreeNode({
  node,
  depth,
  labels,
  onOpenSession,
}: {
  node: SubagentNode;
  depth: number;
  labels: Props["labels"];
  onOpenSession: (sessionId: string) => void;
}) {
  return (
    <div className="subagent-tree-node" style={{ "--subagent-depth": depth } as React.CSSProperties}>
      <button type="button" onClick={() => onOpenSession(node.sessionId)}>
        <span className={"subagent-state " + (node.active ? "active" : node.status)}>
          <Icon name={node.active ? "review" : node.status === "completed" ? "done" : "subagent"} size={13} />
        </span>
        <span className="subagent-tree-copy">
          <strong>{node.goal}</strong>
          <small>{[node.mode === "imported" ? labels.imported : "", statusLabel(node, labels), node.runtime.branch || ""].filter(Boolean).join(" · ")}</small>
        </span>
      </button>
      {(node.children || []).map((child) => (
        <TreeNode
          key={child.sessionId}
          node={child}
          depth={depth + 1}
          labels={labels}
          onOpenSession={onOpenSession}
        />
      ))}
    </div>
  );
}

// The subagent/execution hierarchy for the selected session; each row opens the child session.
export function SubagentTreePanel({ nodes, labels, onOpenSession }: Props) {
  return (
    <InspectorSection
      title={labels.title}
      badge={nodes.length > 0 && <span className="tp-pane-count">{nodes.length}</span>}
    >
      {nodes.length > 0 ? (
        <div className="subagent-tree">
          {nodes.map((node) => (
            <TreeNode
              key={node.sessionId}
              node={node}
              depth={0}
              labels={labels}
              onOpenSession={onOpenSession}
            />
          ))}
        </div>
      ) : (
        <p className="tp-pane-muted">{labels.empty}</p>
      )}
    </InspectorSection>
  );
}
