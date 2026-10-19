import { useCallback, useState } from "react";
import type { ConfigState, Session } from "../../types";
import {
  chooseModel,
  displayedModel,
  explicitModelRef,
  noExplicitModel,
  type ExplicitModel,
} from "../model-selection";

type Options = {
  config: Pick<ConfigState, "model">;
  // The open session, or undefined on the new-task route.
  session: Pick<Session, "modelRef"> | undefined;
  sessionId: string;
  // The model the user last chose, already checked against the configured models. A new task
  // starts on it instead of the configured default; an open session keeps its pinned model.
  preferred?: string;
};

// The picker shows the session's pinned model, or Effective.Model for a new task, until the user
// intentionally picks another. Only that pick is sent to Core as AgentOptions.ModelRef.
export function useModelSelection({ config, session, sessionId, preferred }: Options) {
  const [chosen, setExplicit] = useState<ExplicitModel>(noExplicitModel);
  const explicit: ExplicitModel =
    chosen.scope === sessionId && chosen.ref
      ? chosen
      : sessionId === "" && preferred && preferred !== config.model
        ? { scope: "", ref: preferred }
        : noExplicitModel;
  const modelRef = displayedModel(explicit, sessionId, session, config.model);

  const selectModel = useCallback(
    (ref: string) => setExplicit(chooseModel(ref, sessionId, session, config.model)),
    [config.model, session, sessionId],
  );
  const reset = useCallback(() => setExplicit(noExplicitModel), []);

  return {
    modelRef,
    selectModel,
    resetModelChoice: reset,
    agentModelRef: () => explicitModelRef(explicit, sessionId, session),
  };
}
