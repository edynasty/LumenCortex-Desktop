import type { ProviderCatalog, ProviderDefinition, ProviderModel } from "../../types";

export type ProviderDraft = {
  id: string;
  name: string;
  baseURL: string;
  endpoint: string;
  apiKey: string;
};

export type ModelDraft = {
  id: string;
  name: string;
  modelID: string;
  context: string;
  output: string;
};

export type DeleteTarget =
  | { kind: "provider"; providerId: string }
  | { kind: "model"; providerId: string; modelId: string };

export const emptyProvider: ProviderDraft = {
  id: "",
  name: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
};

export const emptyModel: ModelDraft = {
  id: "",
  name: "",
  modelID: "",
  context: "",
  output: "",
};

export function cloneCatalog(catalog: ProviderCatalog): ProviderCatalog {
  return JSON.parse(JSON.stringify(catalog)) as ProviderCatalog;
}

function envReferenceName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{env:") && trimmed.endsWith("}")) {
    return trimmed.slice(5, -1).trim();
  }
  return "";
}

export function envReference(value: string): string | undefined {
  const name = value.trim();
  return name ? `{env:${name}}` : undefined;
}

export function providerToDraft(id: string, provider: ProviderDefinition): ProviderDraft {
  return {
    id,
    name: provider.name || "",
    baseURL: provider.settings?.baseURL || "",
    endpoint: provider.settings?.endpoint || "",
    apiKey: envReferenceName(provider.settings?.apiKey || ""),
  };
}

export function modelToDraft(id: string, model: ProviderModel): ModelDraft {
  return {
    id,
    name: model.name || "",
    modelID: model.modelID || "",
    context: model.limit?.context ? String(model.limit.context) : "",
    output: model.limit?.output ? String(model.limit.output) : "",
  };
}

export function modelFromDraft(draft: ModelDraft): ProviderModel {
  const context = Number(draft.context);
  const output = Number(draft.output);
  const limit =
    (Number.isFinite(context) && context > 0) || (Number.isFinite(output) && output > 0)
      ? {
          context: Number.isFinite(context) && context > 0 ? context : undefined,
          output: Number.isFinite(output) && output > 0 ? output : undefined,
        }
      : undefined;

  return {
    name: draft.name.trim() || undefined,
    modelID: draft.modelID.trim() || undefined,
    limit,
  };
}

export function modelKeyFromUpstream(id: string, existing: Record<string, ProviderModel>): string {
  const base = id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "model";
  let key = base;
  let suffix = 2;
  while (existing[key] && existing[key].modelID !== id) {
    key = `${base}-${suffix++}`;
  }
  return key;
}
