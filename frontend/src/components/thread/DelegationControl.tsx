import { DELEGATION_ORDER, underCeiling } from "../../app/agent-catalog";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { Delegation } from "../../types";
import { MenuPicker } from "../composer/MenuPicker";
import { Icon } from "../primitives/Icon";

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
  // The thread agent's delegation ceiling and why it caps the grant; "isolated" caps nothing.
  ceiling: Delegation;
  cappedReason?: string;
  labels: Labels;
  onChange: (value: Delegation) => void;
};

const delegationIcon = { none: "discussion", propose: "proposal", isolated: "task" } as const;

// DelegationControl is the thread's grant line (ADR-0006 D4). It records the user's choice; Core
// receives it with each Start, caps it by the agent's delegation ceiling (ADR-0009) and alone
// decides what a run may do with it.
export function DelegationControl({ value, fixed, disabled, ceiling, cappedReason, labels, onChange }: Props) {
  if (fixed) {
    return (
      <span className="chip is-static is-collapsible delegation-control fixed" title={labels.delegationFixed}>
        <Icon name="lock" size={12} />
        <span className="chip-label">{labels.delegationFixed}</span>
      </span>
    );
  }
  const cap = underCeiling(DELEGATION_ORDER, value, ceiling);
  const capped = cap.allowed.length === 1;
  return (
    <span className={`delegation-control ${cap.effective}`} title={capped ? undefined : labels.delegationNextTurn}>
      <MenuPicker
        ariaLabel={labels.delegation}
        collapsible
        value={cap.effective}
        placeholder={labels.delegationNone}
        disabled={disabled || capped}
        disabledReason={capped ? cappedReason : undefined}
        options={[
          { value: "none", label: labels.delegationNone, description: labels.delegationNoneDescription, icon: delegationIcon.none },
          { value: "propose", label: labels.delegationPropose, description: labels.delegationProposeDescription, icon: delegationIcon.propose },
          { value: "isolated", label: labels.delegationIsolated, description: labels.delegationIsolatedDescription, icon: delegationIcon.isolated },
        ].filter((option) => cap.allowed.includes(option.value as Delegation))}
        onChange={(next) => onChange(next as Delegation)}
      />
    </span>
  );
}
