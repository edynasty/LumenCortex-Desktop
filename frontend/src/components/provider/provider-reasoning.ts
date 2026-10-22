import type { AppCopy } from "../../lib/i18n/app-copy";
import type { ModelDraft } from "./provider-settings-model";
import type { providerCopy, ProviderLocale } from "./provider-copy";

type Copy = (typeof providerCopy)[ProviderLocale];

// The two Core values that cannot be combined: adaptive thinking cannot be turned off, so an
// adaptive model's efforts list must not contain "none" (config.validateReasoning). The form
// removes the pairing before a save; the backend refuses it again if it still arrives.
export const ADAPTIVE_FORMAT = "adaptive";
const NONE = "none";

const EFFORT_LABEL: Record<string, "effortNone" | "effortLow" | "effortMedium" | "effortHigh" | "effortMax"> = {
  none: "effortNone",
  low: "effortLow",
  medium: "effortMedium",
  high: "effortHigh",
  max: "effortMax",
};

/** A level's label from the app copy; an unknown level is shown as Core spells it. */
export function effortLabel(level: string, labels: AppCopy): string {
  const key = EFFORT_LABEL[level];
  return key ? labels[key] : level;
}

/** The format's label: the empty string is the provider package's default, not a value. */
export function formatLabel(format: string, t: Copy): string {
  return format === "" ? t.reasoningFormatDefault : format;
}

/** Choosing adaptive drops "none" from the list, because Core refuses the pairing. */
export function withReasoningFormat(draft: ModelDraft, format: string): ModelDraft {
  return {
    ...draft,
    format,
    efforts: format === ADAPTIVE_FORMAT ? draft.efforts.filter((level) => level !== NONE) : draft.efforts,
  };
}

/** Ticking a level adds it in Core's order; unticking removes it. */
export function withEffort(draft: ModelDraft, level: string, on: boolean, levels: string[]): ModelDraft {
  if (!on) return { ...draft, efforts: draft.efforts.filter((item) => item !== level) };
  const next = levels.filter((item) => item === level || draft.efforts.includes(item));
  return { ...draft, efforts: next };
}

/** True for the one level the current format cannot accept. */
export function effortDisabled(format: string, level: string): boolean {
  return format === ADAPTIVE_FORMAT && level === NONE;
}
