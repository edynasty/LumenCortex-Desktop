import { Bot, CheckCircle2, CircleDot, Clock3 } from "lucide-react";
import type { SessionCheckpoint, SubagentNode } from "../../types";

type Props = {
  nodes: SubagentNode[];
  checkpoints: SessionCheckpoint[];
  labels: {
    title: string;
    empty: string;
    active: string;
    completed: string;
    interrupted: string;
    checkpoint: string;
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
          {node.active
            ? <CircleDot size={12} strokeWidth={1.8} aria-hidden />
            : node.status === "completed"
              ? <CheckCircle2 size={12} strokeWidth={1.8} aria-hidden />
              : <Bot size={12} strokeWidth={1.7} aria-hidden />}
        </span>
        <span className="subagent-tree-copy">
          <strong>{node.goal}</strong>
          <small>{statusLabel(node, labels)}{node.runtime.branch ? ` · ${node.runtime.branch}` : ""}</small>
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

export function SubagentTreePanel({ nodes, checkpoints, labels, onOpenSession }: Props) {
  const recentCheckpoints = checkpoints
    .filter((item) => item.reason.startsWith("subagent."))
    .slice(0, 6);

  return (
    <div className="settings-group subagent-group">
      <div className="settings-title">
        <span className="subagent-title"><Bot size={13} strokeWidth={1.7} aria-hidden /> {labels.title}</span>
        <span>{nodes.length}</span>
      </div>

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
        <p className="settings-note">{labels.empty}</p>
      )}

      {recentCheckpoints.length > 0 && (
        <div className="subagent-checkpoints">
          <div className="subagent-checkpoint-title">
            <Clock3 size={11} strokeWidth={1.7} aria-hidden />
            {labels.checkpoint}
          </div>
          {recentCheckpoints.map((item) => (
            <div className="subagent-checkpoint" key={item.seq}>
              <span>{item.reason.replace("subagent.", "")}</span>
              <time>{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
