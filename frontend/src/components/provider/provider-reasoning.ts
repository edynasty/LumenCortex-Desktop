import type { AppCopy } from "../../lib/i18n/app-copy";
import { EFFORT_LABEL_KEY } from "../../app/model-selection";
import type { AgentEffort, ReasoningEffortChoices } from "../../types";
import type { ModelDraft } from "./provider-settings-model";
import type { providerCopy, ProviderLocale } from "./provider-copy";

type Copy = (typeof providerCopy)[ProviderLocale];

// Adaptive thinking is the format whose restriction the form explains in its hint. Which levels a
// format accepts comes from Core (ReasoningEffortChoices.accepted); the backend refuses a pairing
// again if it still arrives.
export const ADAPTIVE_FORMAT = "adaptive";

/** A level's label from the app copy; an unknown level is shown as Core spells it. */
export function effortLabel(level: string, labels: AppCopy): string {
  const key = EFFORT_LABEL_KEY[level as AgentEffort];
  return key ? labels[key] : level;
}

/** The format's label: the empty string is the provider package's default, not a value. */
export function formatLabel(format: string, t: Copy): string {
  return format === "" ? t.reasoningFormatDefault : format;
}

/** The levels the format accepts; a format Core did not describe is not restricted here. */
function acceptedLevels(format: string, choices: ReasoningEffortChoices): string[] {
  return choices.accepted[format] ?? choices.levels;
}

/** Choosing a format drops the ticked levels it does not accept, because Core refuses them. */
export function withReasoningFormat(draft: ModelDraft, format: string, choices: ReasoningEffortChoices): ModelDraft {
  const accepted = acceptedLevels(format, choices);
  return { ...draft, format, efforts: draft.efforts.filter((level) => accepted.includes(level)) };
}

/** Ticking a level adds it in Core's order; unticking removes it. */
export function withEffort(draft: ModelDraft, level: string, on: boolean, levels: string[]): ModelDraft {
  if (!on) return { ...draft, efforts: draft.efforts.filter((item) => item !== level) };
  const next = levels.filter((item) => item === level || draft.efforts.includes(item));
  return { ...draft, efforts: next };
}

/** True for a level the current format does not accept. */
export function effortDisabled(format: string, level: string, choices: ReasoningEffortChoices): boolean {
  return !acceptedLevels(format, choices).includes(level);
}
