import type { AppCopy } from "../../lib/i18n/app-copy";
import type { AgentEffort } from "../../types";
import { clampEffort, type EffortChoice } from "../../app/model-selection";
import type { PickerOption } from "../composer/ComposerPickers";

const EFFORT_LABEL: Record<AgentEffort, "effortNone" | "effortLow" | "effortMedium" | "effortHigh" | "effortMax" | "effortAuto"> = {
  none: "effortNone",
  low: "effortLow",
  medium: "effortMedium",
  high: "effortHigh",
  max: "effortMax",
  auto: "effortAuto",
};

// Why a level will not reach every candidate as chosen: a single model names the level Core sends
// instead (ClampEffort), several count the candidates that clamp it.
function clampNote(choice: EffortChoice, lists: (string[] | undefined)[], labels: AppCopy): string | undefined {
  if (!choice.clampedFor.length) return undefined;
  if (lists.length === 1) {
    const level = clampEffort(choice.level, lists[0] ?? []);
    return labels.agentsEffortClampedOne.replace("{level}", labels[EFFORT_LABEL[level]]);
  }
  return labels.agentsEffortClamped
    .replace("{count}", String(choice.clampedFor.length))
    .replace("{total}", String(lists.length));
}

/**
 * The effort menu for one set of models: "Default" (send nothing), then every level the choices
 * carry in Core's order. A level some of these models would clamp says so before a run, not after.
 */
export function effortMenuOptions(
  choices: EffortChoice[],
  lists: (string[] | undefined)[],
  labels: AppCopy,
): PickerOption[] {
  return [
    { value: "", label: labels.effortDefault },
    ...choices.map((choice) => ({
      value: choice.level,
      label: labels[EFFORT_LABEL[choice.level]],
      description: clampNote(choice, lists, labels),
    })),
  ];
}
