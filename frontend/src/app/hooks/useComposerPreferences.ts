import { useCallback, useMemo, useState } from "react";
import type { ConfigState } from "../../types";
import type { AgentPolicy } from "../agent-config";
import { readComposerPreferences, saveComposerPreferences } from "../composer-preferences";
import { executableModels } from "../model-selection";

// Permission and the last chosen model: App-level so they survive thread switches, and remembered
// so they survive a restart. The agent selection and effort are remembered by useAgentProfiles and
// useComposerModelControls.
export function useComposerPreferences(models: ConfigState["models"]) {
  const [policy, setPolicyState] = useState<AgentPolicy>(() => readComposerPreferences().policy);
  const [preferredModel, setPreferredModel] = useState(() => readComposerPreferences().modelRef);

  const setPolicy = useCallback((next: AgentPolicy) => {
    setPolicyState(next);
    saveComposerPreferences({ policy: next });
  }, []);
  const rememberModel = useCallback((ref: string) => {
    setPreferredModel(ref);
    saveComposerPreferences({ modelRef: ref });
  }, []);

  // A remembered model that is no longer configured (or cannot run an agent) is ignored, not sent.
  const usableModel = useMemo(
    () => (preferredModel && executableModels(models).some((model) => model.ref === preferredModel) ? preferredModel : undefined),
    [models, preferredModel],
  );

  return { policy, setPolicy, rememberModel, usableModel };
}
