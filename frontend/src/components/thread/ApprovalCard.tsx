import type { WorkflowSummary } from "../../types";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { Markdown } from "./Markdown";

type Props = {
  summary: WorkflowSummary;
  busy: boolean;
  approveLabel: string;
  titleLabel: string;
  onApprove: (gateId: string) => void;
};

// The approval gate (Lumen Glass gate block): a warn-tinted card that asks the reader for a
// decision. One block per pending human gate; approving is the only writer Core offers here.
export function ApprovalCard({ summary, busy, approveLabel, titleLabel, onApprove }: Props) {
  const humanGates = (summary.pendingGates || []).filter((gate) => gate.type === "human");
  if (!humanGates.length) return null;

  return (
    <>
      {humanGates.map((gate) => (
        <section className="block gate-block" key={gate.id} aria-live="polite" aria-label={titleLabel}>
          <header className="block-head">
            <Icon name="gate" size={16} className="block-icon" />
            <span className="block-kicker">{titleLabel}</span>
            <h3>{gate.title || gate.id}</h3>
          </header>
          {gate.description && <div className="block-body"><Markdown text={gate.description} /></div>}
          <footer className="block-actions">
            <Button
              variant="primary"
              icon={<Icon name="checkmark" size={13} />}
              disabled={busy}
              onClick={() => onApprove(gate.id)}
            >
              {approveLabel}
            </Button>
          </footer>
        </section>
      ))}
    </>
  );
}
