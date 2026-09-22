import { Bot, CheckCircle2, CircleDot, GitBranch, ShieldCheck, Wrench } from "lucide-react";
import type { RuntimeEvent } from "../../types";
import { milestonesFromEvents } from "./milestones";

type Labels = Parameters<typeof milestonesFromEvents>[1] & {
  empty: string;
};

type Props = {
  events: RuntimeEvent[];
  labels: Labels;
};

function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MilestoneIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "tool": return <Wrench size={12} strokeWidth={1.7} aria-hidden />;
    case "approval": return <ShieldCheck size={12} strokeWidth={1.7} aria-hidden />;
    case "subagent": return <Bot size={12} strokeWidth={1.7} aria-hidden />;
    case "worktree": return <GitBranch size={12} strokeWidth={1.7} aria-hidden />;
    case "result": return <CheckCircle2 size={12} strokeWidth={1.7} aria-hidden />;
    default: return <CircleDot size={12} strokeWidth={1.7} aria-hidden />;
  }
}

export function MilestoneList({ events, labels }: Props) {
  const items = milestonesFromEvents(events, labels);
  if (!items.length) {
    return <div className="inspector-empty">{labels.empty}</div>;
  }

  return (
    <div className="milestone-list">
      {items.slice().reverse().map((item) => (
        <div className={"milestone-item " + (item.state || "")} key={item.key}>
          <div className="milestone-icon"><MilestoneIcon kind={item.kind} /></div>
          <div className="milestone-copy">
            <div>
              <strong>{item.title}</strong>
              <time>{formatClock(item.at)}</time>
            </div>
            {item.detail && <small>{item.detail}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}
