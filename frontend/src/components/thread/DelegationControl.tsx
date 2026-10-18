import { Lock, Network } from "lucide-react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { Delegation } from "../../types";
import { DesktopSelect } from "../primitives/Select";

type Labels = Pick<
  AppCopy,
  | "delegation"
  | "delegationNone"
  | "delegationPropose"
  | "delegationIsolated"
  | "delegationNoneDescription"
  | "delegationProposeDescription"
  | "delegationIsolatedDescription"
  | "delegationNextTurn"
  | "delegationFixed"
>;

type Props = {
  value: Delegation;
  // A child thread holds no grant: Core fixes its authority at every Start.
  fixed: boolean;
  disabled: boolean;
  labels: Labels;
  onChange: (value: Delegation) => void;
};

// DelegationControl is the thread's grant line (ADR-0006 D4). It records the user's choice; Core
// receives it with each Start and alone decides what a run may do with it.
export function DelegationControl({ value, fixed, disabled, labels, onChange }: Props) {
  if (fixed) {
    return (
      <span className="delegation-control fixed" title={labels.delegationFixed}>
        <Lock size={11} strokeWidth={1.8} aria-hidden />
        {labels.delegationFixed}
      </span>
    );
  }
  return (
    <span className={`delegation-control ${value}`} title={labels.delegationNextTurn}>
      <Network size={12} strokeWidth={1.7} aria-hidden />
      <DesktopSelect
        ariaLabel={labels.delegation}
        value={value}
        placeholder={labels.delegationNone}
        disabled={disabled}
        showDescriptionInTrigger={false}
        className="composer-delegation-trigger"
        options={[
          { value: "none", label: labels.delegationNone, description: labels.delegationNoneDescription, group: labels.delegationNextTurn },
          { value: "propose", label: labels.delegationPropose, description: labels.delegationProposeDescription, group: labels.delegationNextTurn },
          { value: "isolated", label: labels.delegationIsolated, description: labels.delegationIsolatedDescription, group: labels.delegationNextTurn },
        ]}
        onChange={(next) => onChange(next as Delegation)}
      />
    </span>
  );
}
