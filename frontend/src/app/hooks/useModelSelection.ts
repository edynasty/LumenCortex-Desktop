import { useCallback, useState } from "react";
import type { ConfigState, Session } from "../../types";
import {
  baselineModel,
  chooseModel,
  displayedModel,
  explicitModelRef,
  noExplicitModel,
  type ExplicitModel,
  type ModelBaseline,
} from "../model-selection";

type Options = {
  config: Pick<ConfigState, "model">;
  // The open session, or undefined on the new-task route.
  session: Pick<Session, "modelRef"> | undefined;
  sessionId: string;
  // The model the user last chose, already checked against the configured models. A new task
  // starts on it instead of the configured default; an open session keeps its pinned model.
  preferred?: string;
  // The selected agent's first model and whether it differs from the thread's pinned agent: Core
  // resolves the agent's list before the default (internal/agent/policy.go ResolveModelRef).
  agentFirst?: string;
  agentSwitched?: boolean;
};

// The picker shows what Core would run: the agent's first model for a switched agent or a new task
// with its own list, else the session's pinned model, else Effective.Model, until the user
// intentionally picks another. Only that pick is sent to Core as AgentOptions.ModelRef.
export function useModelSelection({ config, session, sessionId, preferred, agentFirst, agentSwitched }: Options) {
  const baseline: ModelBaseline = { agentFirst, switched: agentSwitched };
  const [chosen, setExplicit] = useState<ExplicitModel>(noExplicitModel);
  const explicit: ExplicitModel =
    chosen.scope === sessionId && chosen.ref
      ? chosen
      : sessionId === "" && preferred && preferred !== baselineModel(session, config.model, baseline)
        ? { scope: "", ref: preferred }
        : noExplicitModel;
  const modelRef = displayedModel(explicit, sessionId, session, config.model, baseline);

  const selectModel = useCallback(
    (ref: string) => setExplicit(chooseModel(ref, sessionId, session, config.model, baseline)),
    [baseline.agentFirst, baseline.switched, config.model, session, sessionId],
  );
  const reset = useCallback(() => setExplicit(noExplicitModel), []);

  return {
    modelRef,
    selectModel,
    resetModelChoice: reset,
    agentModelRef: () => explicitModelRef(explicit, sessionId, session),
  };
}
