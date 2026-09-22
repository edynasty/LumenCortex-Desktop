import { useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import type {
  ProviderCatalog,
  ProviderCatalogScope,
  ProviderDefinition,
  ProviderModel,
} from "../../types";
import { providerCopy, type ProviderLocale } from "./provider-copy";
import type { ProviderPreset } from "./provider-presets";
import {
  cloneCatalog,
  emptyModel,
  emptyProvider,
  envReference,
  modelFromDraft,
  modelKeyFromUpstream,
  modelToDraft,
  providerToDraft,
  type DeleteTarget,
  type ModelDraft,
  type ProviderDraft,
} from "./provider-settings-model";

type Options = {
  locale: ProviderLocale;
  workspace: string;
  selectedModelRef: string;
  onSelectedModelRef: (value: string) => void;
  onEffectiveCatalogChange: (catalog: ProviderCatalog) => void;
  onError: (message: string) => void;
};

export function useProviderSettingsController({
  locale,
  workspace,
  selectedModelRef,
  onSelectedModelRef,
  onEffectiveCatalogChange,
  onError,
}: Options) {
  const t = providerCopy[locale];
  const [scope, setScope] = useState<ProviderCatalogScope>("global");
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
  const [providerAction, setProviderAction] = useState<string | null>(null);
  const [providerNotice, setProviderNotice] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!workspace && scope === "workspace") {
      setScope("global");
    }
  }, [workspace, scope]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bridge.providerCatalogScope(scope)
      .then((next) => {
        if (cancelled) return;
        setCatalog(next);
        setAdvancedJSON(JSON.stringify(next, null, 2));
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

  async function saveCatalog(next: ProviderCatalog): Promise<boolean> {
    setSaving(true);
    try {
      const saved = await bridge.saveProviderCatalogScope(scope, next);
      setCatalog(saved);
      setAdvancedJSON(JSON.stringify(saved, null, 2));
      setAdvancedDirty(false);

      const effective = await bridge.providerCatalog();
      onEffectiveCatalogChange(effective);

      const availableRefs = Object.entries(effective.providers || {}).flatMap(([providerId, provider]) =>
        Object.keys(provider.models || {}).map((modelId) => providerId + "/" + modelId),
      );
      const nextSelected =
        selectedModelRef && availableRefs.includes(selectedModelRef)
          ? selectedModelRef
          : effective.model || availableRefs[0] || "";
      onSelectedModelRef(nextSelected);
      return true;
    } catch (err) {
      onError(String(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function startAddProvider(preset?: ProviderPreset) {
    setProviderDraft(
      preset
        ? {
            id: preset.id,
            name: preset.name,
            baseURL: preset.baseURL,
            endpoint: "",
            apiKey: preset.envVar,
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
      package: previous?.package || "openai-compatible",
      settings: {
        baseURL: providerDraft.baseURL.trim() || undefined,
        endpoint: providerDraft.endpoint.trim() || undefined,
        apiKey: envReference(providerDraft.apiKey),
      },
      models: previous?.models || {},
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

    provider.models[modelId] = modelFromDraft(modelDraft);
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
    if (!(await saveCatalog(next))) return;
    onSelectedModelRef(ref);
  }

  async function testConnection(providerId: string) {
    setProviderAction("test:" + providerId);
    try {
      const result = await bridge.testProviderConnection(providerId);
      setProviderNotice((current) => ({ ...current, [providerId]: result.message }));
    } catch (err) {
      onError(String(err));
    } finally {
      setProviderAction(null);
    }
  }

  async function discoverModels(providerId: string) {
    setProviderAction("discover:" + providerId);
    try {
      const discovered = await bridge.discoverProviderModels(providerId);
      const next = cloneCatalog(catalog);
      const provider = next.providers[providerId];
      if (!provider) return;
      provider.models ||= {};
      for (const item of discovered) {
        const key = modelKeyFromUpstream(item.id, provider.models);
        provider.models[key] ||= { name: item.id, modelID: item.id };
      }
      if (!(await saveCatalog(next))) return;
      setExpandedProvider(providerId);
      setProviderNotice((current) => ({
        ...current,
        [providerId]: t.discoveredModels.replace("{count}", String(discovered.length)),
      }));
    } catch (err) {
      onError(String(err));
    } finally {
      setProviderAction(null);
    }
  }

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
    saveAdvancedJSON,
  };
}
