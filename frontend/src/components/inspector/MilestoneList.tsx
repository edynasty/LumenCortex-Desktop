import type { RuntimeEvent } from "../../types";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
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
    case "tool": return <Icon name="tool" size={12} />;
    case "approval": return <Icon name="permission" size={12} />;
    case "subagent": return <Icon name="subagent" size={12} />;
    case "worktree": return <Icon name="worktree" size={12} />;
    case "result": return <Icon name="done" size={12} />;
    default: return <Icon name="review" size={12} />;
  }
}

export function MilestoneList({ events, labels }: Props) {
  const items = milestonesFromEvents(events, labels);
  if (!items.length) {
    return <EmptyState compact icon={<Icon name="review" size={18} />} title={labels.empty} />;
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
