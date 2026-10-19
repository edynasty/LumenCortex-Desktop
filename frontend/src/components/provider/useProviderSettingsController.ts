import { useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import { coreErrorKey } from "../../lib/core-errors";
import type {
  ProviderCatalog,
  ProviderCatalogDocument,
  ProviderCatalogScope,
  ProviderDefinition,
  ProviderModel,
} from "../../types";
import { providerCopy, type ProviderLocale } from "./provider-copy";
import { useProviderRuntimeActions } from "./useProviderRuntimeActions";
import type { ProviderPreset } from "./provider-presets";
import {
  cloneCatalog,
  emptyModel,
  emptyProvider,
  envNameValid,
  envReference,
  modelFromDraft,
  modelToDraft,
  providerToDraft,
  type DeleteTarget,
  type ModelDraft,
  type ProviderDraft,
} from "./provider-settings-model";

const scopeStorageKey = (workspace: string) => `lcx-provider-scope:${workspace || "__global__"}`;

function initialScope(workspace: string): ProviderCatalogScope {
  if (!workspace) return "global";
  return localStorage.getItem(scopeStorageKey(workspace)) === "workspace" ? "workspace" : "global";
}

type Options = {
  locale: ProviderLocale;
  workspace: string;
  onConfigChanged: () => void;
  onError: (message: string) => void;
};

/** The provider panes' shared controller: scope, catalog, drafts, edits and runtime actions. */
export type ProviderSettingsController = {
  scope: ProviderCatalogScope;
  setScope: (next: ProviderCatalogScope) => void;
  catalog: ProviderCatalog;
  loading: boolean;
  saving: boolean;
  providers: [string, ProviderDefinition][];
  expandedProvider: string | null;
  setExpandedProvider: (providerId: string | null) => void;
  editingProvider: string | "new" | null;
  setEditingProvider: (value: string | "new" | null) => void;
  providerDraft: ProviderDraft;
  setProviderDraft: (draft: ProviderDraft) => void;
  editingModel: { providerId: string; modelId?: string } | null;
  setEditingModel: (value: { providerId: string; modelId?: string } | null) => void;
  modelDraft: ModelDraft;
  setModelDraft: (draft: ModelDraft) => void;
  advancedOpen: boolean;
  setAdvancedOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  advancedJSON: string;
  setAdvancedJSON: (value: string) => void;
  advancedDirty: boolean;
  setAdvancedDirty: (value: boolean) => void;
  deleteTarget: DeleteTarget | null;
  setDeleteTarget: (value: DeleteTarget | null) => void;
  providerAction: string | null;
  providerNotice: Record<string, string>;
  startAddProvider: (preset?: ProviderPreset) => void;
  startEditProvider: (providerId: string, provider: ProviderDefinition) => void;
  commitProvider: () => Promise<void>;
  removeProvider: (providerId: string) => Promise<void>;
  startAddModel: (providerId: string) => void;
  startEditModel: (providerId: string, modelId: string, model: ProviderModel) => void;
  commitModel: () => Promise<void>;
  removeModel: (providerId: string, modelId: string) => Promise<void>;
  setDefaultModel: (providerId: string, modelId: string) => Promise<void>;
  testConnection: (providerId: string) => Promise<void>;
  discoverModels: (providerId: string) => Promise<void>;
  reloadCatalog: () => Promise<void>;
  saveAdvancedJSON: () => Promise<void>;
};

export function useProviderSettingsController({
  locale,
  workspace,
  onConfigChanged,
  onError,
}: Options): ProviderSettingsController {
  const t = providerCopy[locale];
  const [scope, setScopeState] = useState<ProviderCatalogScope>(() => initialScope(workspace));
  // The file as it was read. Its digest travels with every save, so a file that changed on disk
  // since is a conflict instead of being overwritten.
  const [loadedFile, setLoadedFile] = useState<ProviderCatalogDocument | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalog>({ providers: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<string | "new" | null>(null);
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(emptyProvider);
  const [editingModel, setEditingModel] = useState<{ providerId: string; modelId?: string } | null>(null);
  const [modelDraft, setModelDraft] = useState<ModelDraft>(emptyModel);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedJSON, setAdvancedJSON] = useState("");
  const [advancedDirty, setAdvancedDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    setScopeState(initialScope(workspace));
  }, [workspace]);

  function setScope(next: ProviderCatalogScope) {
    const safeScope = !workspace && next === "workspace" ? "global" : next;
    setScopeState(safeScope);
    if (workspace) localStorage.setItem(scopeStorageKey(workspace), safeScope);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bridge.providerCatalogScope(scope)
      .then((next) => {
        if (cancelled) return;
        setLoadedFile(next);
        setCatalog(next.catalog);
        setAdvancedJSON(JSON.stringify(next.catalog, null, 2));
        setAdvancedDirty(false);
        setEditingProvider(null);
        setEditingModel(null);
        setExpandedProvider(null);
      })
      .catch((err) => {
        if (!cancelled) onError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, workspace, onError]);

  const providers = useMemo(
    () => Object.entries(catalog.providers || {}).sort(([a], [b]) => a.localeCompare(b)),
    [catalog],
  );

  function adopt(next: ProviderCatalogDocument) {
    setLoadedFile(next);
    setCatalog(next.catalog);
    setAdvancedJSON(JSON.stringify(next.catalog, null, 2));
    setAdvancedDirty(false);
  }

  async function saveCatalog(next: ProviderCatalog): Promise<boolean> {
    if (!loadedFile) return false;
    setSaving(true);
    try {
      adopt(await bridge.saveProviderCatalogScope(scope, { ...loadedFile, catalog: next }));
      onConfigChanged();
      return true;
    } catch (err) {
      const message = String(err);
      // The file changed under the editor and Core wrote nothing: show what is on disk now.
      if (coreErrorKey(message) === "conflict") {
        try {
          adopt(await bridge.providerCatalogScope(scope));
          onConfigChanged();
        } catch (reloadErr) {
          onError(String(reloadErr));
          return false;
        }
      }
      onError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // The credential section writes the file behind the panel's back (direct-input save/remove);
  // this re-reads it so the digest and advanced JSON stay current. No draft is in flight:
  // the section is only rendered while no provider edit is open.
  async function reloadCatalog() {
    try {
      adopt(await bridge.providerCatalogScope(scope));
      onConfigChanged();
    } catch (err) {
      onError(String(err));
    }
  }

  function startAddProvider(preset?: ProviderPreset) {
    setProviderDraft(
      preset
        ? {
            id: preset.id,
            name: preset.name,
            package: preset.package,
            baseURL: preset.baseURL,
            endpoint: "",
            apiKey: preset.envVar,
            secretRef: "",
          }
        : emptyProvider,
    );
    setEditingProvider("new");
    setEditingModel(null);
  }

  function startEditProvider(providerId: string, provider: ProviderDefinition) {
    setProviderDraft(providerToDraft(providerId, provider));
    setEditingProvider(providerId);
    setExpandedProvider(providerId);
    setEditingModel(null);
  }

  async function commitProvider() {
    const id = providerDraft.id.trim();
    if (!id || id.includes("/")) {
      onError(t.invalidProviderId);
      return;
    }

    // A literal key pasted into the env-name field is refused here (Core's schema would
    // reject it on save anyway); only the variable-name shape may travel into the file.
    if (!envNameValid(providerDraft.apiKey)) {
      onError(t.invalidEnvName);
      return;
    }

    const previousId = editingProvider && editingProvider !== "new" ? editingProvider : null;
    if (catalog.providers[id] && previousId !== id) {
      onError(t.providerIdConflict);
      return;
    }

    const next = cloneCatalog(catalog);
    const previous = previousId ? next.providers[previousId] : undefined;

    if (previousId && previousId !== id) {
      delete next.providers[previousId];
      if (next.model?.startsWith(previousId + "/")) {
        next.model = id + next.model.slice(previousId.length);
      }
    }

    next.providers[id] = {
      name: providerDraft.name.trim() || id,
      package: providerDraft.package,
      settings: {
        baseURL: providerDraft.baseURL.trim() || undefined,
        endpoint: providerDraft.endpoint.trim() || undefined,
        // An env name wins; otherwise a loaded {secret:NAME} reference is kept as-is.
        apiKey: envReference(providerDraft.apiKey) ?? (providerDraft.secretRef || undefined),
      },
      models: previous?.models || {},
      // The backend keeps the fields the panel does not edit (headers, timeouts, ...) only if it
      // knows which entry they belong to.
      renamedFrom: previousId && previousId !== id ? previousId : undefined,
    };

    if (!(await saveCatalog(next))) return;
    setEditingProvider(null);
    setProviderDraft(emptyProvider);
    setExpandedProvider(id);
  }

  async function removeProvider(providerId: string) {
    const next = cloneCatalog(catalog);
    delete next.providers[providerId];
    if (next.model?.startsWith(providerId + "/")) {
      next.model = undefined;
    }
    if (!(await saveCatalog(next))) return;
    if (expandedProvider === providerId) setExpandedProvider(null);
  }

  function startAddModel(providerId: string) {
    setExpandedProvider(providerId);
    setEditingModel({ providerId });
    setModelDraft(emptyModel);
  }

  function startEditModel(providerId: string, modelId: string, model: ProviderModel) {
    setExpandedProvider(providerId);
    setEditingModel({ providerId, modelId });
    setModelDraft(modelToDraft(modelId, model));
  }

  async function commitModel() {
    if (!editingModel) return;
    const modelId = modelDraft.id.trim();
    if (!modelId || modelId.includes("/")) {
      onError(t.invalidModelId);
      return;
    }

    const currentProvider = catalog.providers[editingModel.providerId];
    if (currentProvider?.models?.[modelId] && editingModel.modelId !== modelId) {
      onError(t.modelIdConflict);
      return;
    }

    const next = cloneCatalog(catalog);
    const provider = next.providers[editingModel.providerId];
    if (!provider) return;
    provider.models ||= {};

    const oldModelId = editingModel.modelId;
    if (oldModelId && oldModelId !== modelId) {
      delete provider.models[oldModelId];
      if (next.model === editingModel.providerId + "/" + oldModelId) {
        next.model = editingModel.providerId + "/" + modelId;
      }
    }

    provider.models[modelId] = {
      ...modelFromDraft(modelDraft),
      renamedFrom: oldModelId && oldModelId !== modelId ? oldModelId : undefined,
    };
    if (!(await saveCatalog(next))) return;
    setEditingModel(null);
    setModelDraft(emptyModel);
  }

  async function removeModel(providerId: string, modelId: string) {
    const next = cloneCatalog(catalog);
    const provider = next.providers[providerId];
    if (!provider?.models) return;
    delete provider.models[modelId];
    if (next.model === providerId + "/" + modelId) {
      next.model = undefined;
    }
    await saveCatalog(next);
  }

  async function setDefaultModel(providerId: string, modelId: string) {
    const next = cloneCatalog(catalog);
    const ref = providerId + "/" + modelId;
    next.model = next.model === ref ? undefined : ref;
    await saveCatalog(next);
  }

  const {
    providerAction,
    providerNotice,
    testConnection,
    discoverModels,
  } = useProviderRuntimeActions({
    catalog,
    discoveredModelsLabel: t.discoveredModels,
    onError,
    onSaveCatalog: saveCatalog,
    onExpandedProvider: setExpandedProvider,
  });

  async function saveAdvancedJSON() {
    try {
      const parsed = JSON.parse(advancedJSON) as ProviderCatalog;
      parsed.providers ||= {};
      await saveCatalog(parsed);
    } catch (err) {
      onError(String(err));
    }
  }

  return {
    scope,
    setScope,
    catalog,
    loading,
    saving,
    providers,
    expandedProvider,
    setExpandedProvider,
    editingProvider,
    setEditingProvider,
    providerDraft,
    setProviderDraft,
    editingModel,
    setEditingModel,
    modelDraft,
    setModelDraft,
    advancedOpen,
    setAdvancedOpen,
    advancedJSON,
    setAdvancedJSON,
    advancedDirty,
    setAdvancedDirty,
    deleteTarget,
    setDeleteTarget,
    providerAction,
    providerNotice,
    startAddProvider,
    startEditProvider,
    commitProvider,
    removeProvider,
    startAddModel,
    startEditModel,
    commitModel,
    removeModel,
    setDefaultModel,
    testConnection,
    discoverModels,
    reloadCatalog,
    saveAdvancedJSON,
  };
}
