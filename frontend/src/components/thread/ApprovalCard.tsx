import { ShieldCheck } from "lucide-react";
import type { WorkflowSummary } from "../../types";
import { Button } from "../primitives/Button";

type Props = {
  summary: WorkflowSummary;
  busy: boolean;
  approveLabel: string;
  titleLabel: string;
  onApprove: (gateId: string) => void;
};

export function ApprovalCard({ summary, busy, approveLabel, titleLabel, onApprove }: Props) {
  const humanGates = (summary.pendingGates || []).filter((gate) => gate.type === "human");
  if (!humanGates.length) return null;

  return (
    <section className="thread-approval-card" aria-label={titleLabel}>
      <div className="thread-approval-heading">
        <ShieldCheck size={16} strokeWidth={1.7} aria-hidden />
        <div>
          <strong>{summary.currentTitle || titleLabel}</strong>
          <span>{summary.title}</span>
        </div>
      </div>
      {humanGates.map((gate) => (
        <div className="thread-approval-gate" key={gate.id}>
          <div>
            <strong>{gate.title || gate.id}</strong>
            {gate.description && <p>{gate.description}</p>}
          </div>
          <Button variant="primary" disabled={busy} onClick={() => onApprove(gate.id)}>
            {approveLabel}
          </Button>
        </div>
      ))}
    </section>
  );
}
