import type { ProviderCatalog, ProviderDefinition, ProviderModel, ProviderPackage } from "../../types";

export type ProviderDraft = {
  id: string;
  name: string;
  package: ProviderPackage;
  baseURL: string;
  endpoint: string;
  apiKey: string;
  // The provider's {secret:NAME} reference as loaded, if any. Display-only: the panel never
  // holds a key value, and commit keeps this reference unless an env name replaces it.
  secretRef: string;
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
  package: "openai-compatible",
  baseURL: "",
  endpoint: "",
  apiKey: "",
  secretRef: "",
};

// A configured {secret:NAME} reference as-is ("" when absent). Never a key value.
export function secretReference(value: string | undefined): string {
  const trimmed = (value || "").trim();
  if (trimmed.startsWith("{secret:") && trimmed.endsWith("}") && trimmed.length > "{secret:}".length) {
    return trimmed;
  }
  return "";
}

// Same shape Core's schema enforces for {env:VAR_NAME}: a literal key typed into the env-name
// field fails this and is refused before anything is saved.
const envNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function envNameValid(value: string): boolean {
  const name = value.trim();
  return !name || envNamePattern.test(name);
}

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
    // Missing/legacy packages display (and save) as [OI]-compatible.
    package: provider.package === "anthropic-messages" ? "anthropic-messages" : "openai-compatible",
    baseURL: provider.settings?.baseURL || "",
    endpoint: provider.settings?.endpoint || "",
    apiKey: envReferenceName(provider.settings?.apiKey || ""),
    secretRef: secretReference(provider.settings?.apiKey),
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
