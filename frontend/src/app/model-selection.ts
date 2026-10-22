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
// "auto" is a request value, not a level: it is never part of this order and never appears in a
// model's reasoning.efforts list, so orderedEfforts drops it if a configuration names it there.
export const EFFORT_ORDER: AgentEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

export type EffortLabelKey =
  | "effortNone" | "effortMinimal" | "effortLow" | "effortMedium" | "effortHigh" | "effortXHigh" | "effortMax" | "effortAuto";

// The app-copy key of each effort value; every picker and list labels a level through it.
export const EFFORT_LABEL_KEY: Record<AgentEffort, EffortLabelKey> = {
  none: "effortNone",
  minimal: "effortMinimal",
  low: "effortLow",
  medium: "effortMedium",
  high: "effortHigh",
  xhigh: "effortXHigh",
  max: "effortMax",
  auto: "effortAuto",
};

// AUTO_EFFORT asks Core to classify each turn's difficulty and resolve one level before the first
// request. It needs no judge model (the heuristic fallback always applies), so it is offered for
// every model that has reasoning levels at all.
export const AUTO_EFFORT: AgentEffort = "auto";

export function orderedEfforts(efforts: string[] | undefined): string[] {
  if (!efforts?.length) return [];
  return EFFORT_ORDER.filter((effort) => effort !== AUTO_EFFORT && efforts.includes(effort));
}

// The effort levels one model supports, in Core's order; empty when the model has none.
export function effortsOfModel(ref: string, models: ModelInfo[]): string[] {
  const model = models.find((item) => item.ref === ref);
  return orderedEfforts(model?.efforts);
}

// Core's ClampEffort (internal/agent/policy.go) mirrored for the UI: the lowest listed level not
// below the request, else the highest listed level. An empty list or "" leaves the request alone,
// so a model that declares no levels never changes what is sent. The argument is a concrete level:
// "auto" is a request value Core resolves before clamping and is not passed here.
export function clampEffort(effort: AgentEffort, supported: string[]): AgentEffort {
  if (!effort || !supported.length) return effort;
  let up: string | undefined;
  let highest = supported[0];
  for (const level of supported) {
    const rank = EFFORT_ORDER.indexOf(level as AgentEffort);
    if (rank > EFFORT_ORDER.indexOf(highest as AgentEffort)) highest = level;
    if (rank >= EFFORT_ORDER.indexOf(effort) && (up === undefined || rank < EFFORT_ORDER.indexOf(up as AgentEffort))) {
      up = level;
    }
  }
  return (up ?? highest) as AgentEffort;
}

// One effort menu for a set of models that may all serve the same request: every level any of them
// lists, plus a stored level none lists (Core clamps it for them), in Core's order. `clampedFor`
// names the candidates that would run a different level than the one chosen, so the editor can say
// so before a run rather than after it.
export type EffortChoice = { level: AgentEffort; clampedFor: number[] };

export function effortChoicesFor(lists: (string[] | undefined)[], current?: AgentEffort): EffortChoice[] {
  const union = orderedEfforts(lists.flatMap((list) => list ?? []));
  const levels = current && EFFORT_ORDER.includes(current) && !union.includes(current)
    ? orderedEfforts([...union, current])
    : union;
  return levels.map((level) => ({
    level: level as AgentEffort,
    clampedFor: lists.flatMap((list, index) => (list?.length && !list.includes(level) ? [index] : [])),
  }));
}

// The effort to send for the displayed model: the user's choice only when the model supports it.
// An unsupported choice (model switched, session re-pinned) falls back to the default, never sent.
// "auto" is valid exactly when the model has reasoning levels; a model without them gets nothing.
export function supportedEffort(effort: AgentEffort | undefined, supported: string[]): AgentEffort | undefined {
  if (effort === AUTO_EFFORT) return supported.length ? AUTO_EFFORT : undefined;
  return effort && supported.includes(effort) ? effort : undefined;
}

function modelDisplayName(model: ModelInfo): string {
  if (model.modelName) return model.modelName;
  if (model.modelID) return model.modelID;
  return model.ref.slice(model.ref.lastIndexOf("/") + 1) || model.ref;
}

function configuredOption(model: ModelInfo, defaultRef: string): ConfiguredModelOption {
  const metadata = [
    model.modelID && model.modelID !== model.ref.slice(model.ref.indexOf("/") + 1) ? model.modelID : "",
    model.context ? Math.round(model.context / 1024) + "K ctx" : "",
    model.output ? Math.round(model.output / 1024) + "K out" : "",
  ].filter(Boolean).join(" · ");
  return {
    ref: model.ref,
    label: modelDisplayName(model),
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

// What Core resolves the model from, besides the user's pick (internal/agent/policy.go
// ResolveModelRef): the agent's own first model when it has a list, and whether the selected agent
// differs from the thread's pinned one.
export type ModelBaseline = {
  /** The selected agent's first model; "" when the agent inherits a list. */
  agentFirst?: string;
  /** The selected agent is not the thread's pinned agent, so Core's model.agent rule applies. */
  switched?: boolean;
};

// The model a route starts from, in Core's order: a switched agent takes its own first model (or
// the default), an open session shows the model it is pinned to, and a new task shows the agent's
// first model, else Effective.Model. Continuing never moves a session to the current default.
export function baselineModel(
  session: Pick<Session, "modelRef"> | undefined,
  defaultRef: string,
  baseline: ModelBaseline = {},
): string {
  if (baseline.switched) return baseline.agentFirst || defaultRef;
  return session?.modelRef || baseline.agentFirst || defaultRef;
}

export function displayedModel(
  explicit: ExplicitModel,
  scope: string,
  session: Pick<Session, "modelRef"> | undefined,
  defaultRef: string,
  baseline: ModelBaseline = {},
): string {
  if (explicit.scope === scope && explicit.ref) return explicit.ref;
  return baselineModel(session, defaultRef, baseline);
}

// Choosing the baseline again clears the choice: only a different model is sent.
export function chooseModel(
  ref: string,
  scope: string,
  session: Pick<Session, "modelRef"> | undefined,
  defaultRef: string,
  baseline: ModelBaseline = {},
): ExplicitModel {
  return ref === baselineModel(session, defaultRef, baseline) ? noExplicitModel : { scope, ref };
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
