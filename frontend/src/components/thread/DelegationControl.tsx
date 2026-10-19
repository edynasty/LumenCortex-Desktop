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
  // Why the grant is capped (Ask mode); shown on the disabled control.
  cappedReason?: string;
  labels: Labels;
  onChange: (value: Delegation) => void;
};

const delegationIcon = { none: "discussion", propose: "proposal", isolated: "task" } as const;

// DelegationControl is the thread's grant line (ADR-0006 D4). It records the user's choice; Core
// receives it with each Start and alone decides what a run may do with it.
export function DelegationControl({ value, fixed, disabled, cappedReason, labels, onChange }: Props) {
  if (fixed) {
    return (
      <span className="chip is-static is-collapsible delegation-control fixed" title={labels.delegationFixed}>
        <Icon name="lock" size={12} />
        <span className="chip-label">{labels.delegationFixed}</span>
      </span>
    );
  }
  return (
    <span className={`delegation-control ${value}`} title={cappedReason ?? labels.delegationNextTurn}>
      <MenuPicker
        ariaLabel={labels.delegation}
        collapsible
        value={value}
        placeholder={labels.delegationNone}
        disabled={disabled}
        disabledReason={cappedReason}
        options={[
          { value: "none", label: labels.delegationNone, description: labels.delegationNoneDescription, icon: delegationIcon.none },
          { value: "propose", label: labels.delegationPropose, description: labels.delegationProposeDescription, icon: delegationIcon.propose },
          { value: "isolated", label: labels.delegationIsolated, description: labels.delegationIsolatedDescription, icon: delegationIcon.isolated },
        ]}
        onChange={(next) => onChange(next as Delegation)}
      />
    </span>
  );
}
