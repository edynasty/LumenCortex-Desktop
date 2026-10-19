import { useCallback, useMemo, useState } from "react";
import type { AgentEffort, ConfigState, Session } from "../../types";
import { readComposerPreferences, saveComposerPreferences } from "../composer-preferences";
import {
  effortsOfModel,
  pickerModelOptions,
  pushRecentModel,
  readRecentModels,
  saveRecentModels,
  supportedEffort,
} from "../model-selection";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { ModelPickerOption } from "../model-selection";

type Options = {
  config: Pick<ConfigState, "models" | "model">;
  session: Pick<Session, "modelRef"> | undefined;
  labels: AppCopy;
  selectModel: (ref: string) => void;
  modelRef: string;
  // Called when the user picks a model, so the choice outlives the session and the app.
  onModelChosen?: (ref: string) => void;
};

// The composer's model/effort/recent state: picker options with refusal reasons, the effort levels
// the displayed model supports, and the bounded recent list (refs only, never keys).
export function useComposerModelControls({ config, session, labels, selectModel, modelRef, onModelChosen }: Options) {
  const [effort, setEffortState] = useState<AgentEffort | undefined>(() => readComposerPreferences().effort);
  const setEffort = useCallback((next: AgentEffort | undefined) => {
    setEffortState(next);
    saveComposerPreferences({ effort: next });
  }, []);
  const [recentModelRefs, setRecentModelRefs] = useState<string[]>(() => readRecentModels());

  const pickerModels = useMemo<ModelPickerOption[]>(
    () => pickerModelOptions(config, { missingKey: labels.modelMissingKey, noToolCalling: labels.modelNoToolCalling }),
    [config, labels],
  );
  const effortOptions = useMemo(() => effortsOfModel(modelRef, config.models), [modelRef, config.models]);
  const effectiveEffort = supportedEffort(effort, effortOptions);

  const selectModelFromPicker = useCallback(
    (ref: string) => {
      selectModel(ref);
      onModelChosen?.(ref);
      setRecentModelRefs((refs) => {
        const next = pushRecentModel(refs, ref);
        saveRecentModels(next);
        return next;
      });
      // Switching to a model without the current effort level resets to the default; an
      // unsupported effort is never sent (Core validates Effort against the model). "auto" survives
      // the switch whenever the new model has reasoning levels at all.
      if (effort && !supportedEffort(effort, effortsOfModel(ref, config.models))) setEffort(undefined);
    },
    [config.models, effort, onModelChosen, selectModel, setEffort],
  );

  return { pickerModels, effortOptions, effectiveEffort, recentModelRefs, selectModelFromPicker, setEffort };
}
