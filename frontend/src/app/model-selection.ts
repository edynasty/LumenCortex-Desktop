import type { ConfigState, ModelInfo, Session } from "../types";

// Core owns the catalog, candidate order and failover. This file only decides what the picker
// shows and whether a send names a model; it never chooses a candidate.

export type ConfiguredModelOption = {
  ref: string;
  label: string;
  group: string;
  description: string;
  isDefault: boolean;
  missingSecret: boolean;
};

// A model with toolCalling: false cannot run an agent session, so it is not offered.
export function executableModels(models: ModelInfo[]): ModelInfo[] {
  return models.filter((model) => model.toolCalling);
}

export function modelOptions(config: Pick<ConfigState, "models" | "model">): ConfiguredModelOption[] {
  return executableModels(config.models).map((model) => {
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
      isDefault: config.model === model.ref,
      // apiKeyEnv names a variable the provider reads; apiKeySet says whether it is set. A provider
      // without a key reference needs none.
      missingSecret: Boolean(model.apiKeyEnv) && !model.apiKeySet,
    };
  });
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
// model the session is already pinned to.
export function explicitModelRef(
  explicit: ExplicitModel,
  scope: string,
  session: Pick<Session, "modelRef"> | undefined,
): string | undefined {
  if (explicit.scope !== scope || !explicit.ref) return undefined;
  return explicit.ref === session?.modelRef ? undefined : explicit.ref;
}
