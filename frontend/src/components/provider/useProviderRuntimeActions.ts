import { useState } from "react";
import { bridge } from "../../lib/bridge";
import type { ProviderCatalog } from "../../types";
import { cloneCatalog, modelKeyFromUpstream } from "./provider-settings-model";

type Options = {
  catalog: ProviderCatalog;
  discoveredModelsLabel: string;
  onError: (message: string) => void;
  onSaveCatalog: (catalog: ProviderCatalog) => Promise<boolean>;
  onExpandedProvider: (providerId: string) => void;
};

export function useProviderRuntimeActions({
  catalog,
  discoveredModelsLabel,
  onError,
  onSaveCatalog,
  onExpandedProvider,
}: Options) {
  const [providerAction, setProviderAction] = useState<string | null>(null);
  const [providerNotice, setProviderNotice] = useState<Record<string, string>>({});

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
      if (!(await onSaveCatalog(next))) return;
      onExpandedProvider(providerId);
      setProviderNotice((current) => ({
        ...current,
        [providerId]: discoveredModelsLabel.replace("{count}", String(discovered.length)),
      }));
    } catch (err) {
      onError(String(err));
    } finally {
      setProviderAction(null);
    }
  }

  return {
    providerAction,
    providerNotice,
    testConnection,
    discoverModels,
  };
}
