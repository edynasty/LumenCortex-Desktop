import type { AgentEffort, ConfigState, ModelInfo, Session } from "../types";

// Core owns the catalog, candidate order and failover. This file only decides what the picker
// shows and whether a send names a model; it never chooses a candidate.

export type ConfiguredModelOption = {
  ref: string;
  label: string;
  group: string;
  description: string;
  isDefault: boolean;
  missingSecret: boolean;
  efforts: string[];
};

// A model with toolCalling: false cannot run an agent session, so it is not offered.
export function executableModels(models: ModelInfo[]): ModelInfo[] {
  return models.filter((model) => model.toolCalling);
}

// Core's reasoning-effort order (internal/agent effortOrder); the picker lists a model's levels in it.
export const EFFORT_ORDER: AgentEffort[] = ["none", "low", "medium", "high", "max"];

export function orderedEfforts(efforts: string[] | undefined): string[] {
  if (!efforts?.length) return [];
  return EFFORT_ORDER.filter((effort) => efforts.includes(effort));
}

// The effort levels one model supports, in Core's order; empty when the model has none.
export function effortsOfModel(ref: string, models: ModelInfo[]): string[] {
  const model = models.find((item) => item.ref === ref);
  return orderedEfforts(model?.efforts);
}

// The effort to send for the displayed model: the user's choice only when the model supports it.
// An unsupported choice (model switched, session re-pinned) falls back to the default, never sent.
export function supportedEffort(effort: AgentEffort | undefined, supported: string[]): AgentEffort | undefined {
  return effort && supported.includes(effort) ? effort : undefined;
}

function configuredOption(model: ModelInfo, defaultRef: string): ConfiguredModelOption {
  const metadata = [
    model.modelID && model.modelID !== model.ref.slice(model.ref.indexOf("/") + 1) ? model.modelID : "",
    model.context ? Math.round(model.context / 1024) + "K ctx" : "",
    model.output ? Math.round(model.output / 1024) + "K out" : "",
  ].filter(Boolean).join(" · ");
  return {
    ref: model.ref,
    label: model.modelName || model.ref,
    group: model.providerName,
    description: metadata,
    isDefault: defaultRef === model.ref,
    // apiKeyEnv names a variable the provider reads; apiKeySet says whether it is set. A provider
    // without a key reference needs none.
    missingSecret: Boolean(model.apiKeyEnv) && !model.apiKeySet,
    efforts: orderedEfforts(model.efforts),
  };
}

export function modelOptions(config: Pick<ConfigState, "models" | "model">): ConfiguredModelOption[] {
  return executableModels(config.models).map((model) => configuredOption(model, config.model));
}

export type ModelPickerReasons = { missingKey: string; noToolCalling: string };

export type ModelPickerOption = ConfiguredModelOption & {
  // Selectable in the composer's model picker: a model without tool calling cannot run an agent
  // session, and a model whose provider key is unset cannot be reached. Both stay visible, disabled
  // with their reason.
  disabled: boolean;
  disabledReason?: string;
};

// The searchable composer picker sees every configured model, including the ones it must refuse.
export function pickerModelOptions(
  config: Pick<ConfigState, "models" | "model">,
  reasons: ModelPickerReasons,
): ModelPickerOption[] {
  return config.models.map((model) => {
    const option = configuredOption(model, config.model);
    const noToolCalling = !model.toolCalling;
    const missingKey = option.missingSecret;
    return {
      ...option,
      disabled: noToolCalling || missingKey,
      disabledReason: noToolCalling ? reasons.noToolCalling : missingKey ? reasons.missingKey : undefined,
    };
  });
}

// What the picker shows when the displayed ref is not one of its options: a session pinned to a
// model that was removed or cannot call tools keeps its ref visible, so the user sees what Continue
// would use and why it is refused.
export function pickerPlaceholder(
  modelRef: string,
  options: Pick<ConfiguredModelOption, "ref">[],
  labels: { noModels: string; modelUnavailable: string },
): string {
  if (!modelRef || options.some((option) => option.ref === modelRef)) return labels.noModels;
  return labels.modelUnavailable.replace("{ref}", modelRef);
}

// The user's intentional choice, valid for one route (a session id, or "" for a new task).
export type ExplicitModel = { scope: string; ref: string };

export const noExplicitModel: ExplicitModel = { scope: "", ref: "" };

// The model a route starts from: a session shows the model it is pinned to; a new task shows
// Effective.Model. Continuing never moves a session to the current default.
export function baselineModel(session: Pick<Session, "modelRef"> | undefined, defaultRef: string): string {
  return session?.modelRef || defaultRef;
}

export function displayedModel(
  explicit: ExplicitModel,
  scope: string,
  session: Pick<Session, "modelRef"> | undefined,
  defaultRef: string,
): string {
  if (explicit.scope === scope && explicit.ref) return explicit.ref;
  return baselineModel(session, defaultRef);
}

// Choosing the baseline again clears the choice: only a different model is sent.
export function chooseModel(
  ref: string,
  scope: string,
  session: Pick<Session, "modelRef"> | undefined,
  defaultRef: string,
): ExplicitModel {
  return ref === baselineModel(session, defaultRef) ? noExplicitModel : { scope, ref };
}

// AgentOptions.ModelRef: set only for an intentional selection on this route that differs from the
// model the session is already pinned to. After Core re-pins (rule model.user) the next refresh
// makes session.modelRef the choice, so the pick is sent exactly once.
export function explicitModelRef(
  explicit: ExplicitModel,
  scope: string,
  session: Pick<Session, "modelRef"> | undefined,
): string | undefined {
  if (explicit.scope !== scope || !explicit.ref) return undefined;
  return explicit.ref === session?.modelRef ? undefined : explicit.ref;
}

// ————————————————————————— Recent models —————————————————————————
// A bounded UI preference (refs only, never keys) remembering the models the user picked.

export const RECENT_MODEL_LIMIT = 5;
const RECENT_MODELS_KEY = "lcx-recent-models";

export function readRecentModels(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_MODELS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveRecentModels(refs: string[]): void {
  try {
    localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(refs.slice(0, RECENT_MODEL_LIMIT)));
  } catch {
    // Storage may be unavailable (private mode); the recent list is a nicety, never an error.
  }
}

// Most recent first, duplicates moved to the front, bounded to RECENT_MODEL_LIMIT.
export function pushRecentModel(refs: string[], ref: string): string[] {
  if (!ref) return refs;
  return [ref, ...refs.filter((item) => item !== ref)].slice(0, RECENT_MODEL_LIMIT);
}
