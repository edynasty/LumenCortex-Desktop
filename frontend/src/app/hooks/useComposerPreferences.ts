import { useCallback, useMemo, useState } from "react";
import type { ConfigState } from "../../types";
import type { AgentMode, AgentPolicy } from "../agent-config";
import { readComposerPreferences, saveComposerPreferences } from "../composer-preferences";
import { executableModels } from "../model-selection";

// Permission, Ask/Agent and the last chosen model: App-level so they survive thread switches, and
// remembered so they survive a restart. Effort is remembered by useComposerModelControls.
export function useComposerPreferences(models: ConfigState["models"]) {
  const [policy, setPolicyState] = useState<AgentPolicy>(() => readComposerPreferences().policy);
  const [mode, setModeState] = useState<AgentMode>(() => readComposerPreferences().mode);
  const [preferredModel, setPreferredModel] = useState(() => readComposerPreferences().modelRef);

  const setPolicy = useCallback((next: AgentPolicy) => {
    setPolicyState(next);
    saveComposerPreferences({ policy: next });
  }, []);
  const setMode = useCallback((next: AgentMode) => {
    setModeState(next);
    saveComposerPreferences({ mode: next });
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

  return { policy, setPolicy, mode, setMode, rememberModel, usableModel };
}
