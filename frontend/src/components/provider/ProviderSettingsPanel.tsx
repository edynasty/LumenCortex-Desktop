import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Code2,
  FileJson2,
  Pencil,
  Plus,
  Server,
  Star,
  Trash2,
} from "lucide-react";
import { Dialog } from "../primitives/Dialog";
import { bridge } from "../../lib/bridge";
import type {
  ProviderCatalog,
  ProviderCatalogScope,
  ProviderDefinition,
  ProviderModel,
} from "../../types";
import { providerCopy, type ProviderLocale } from "./provider-copy";
import "./provider-settings.css";

type ProviderDraft = {
  id: string;
  name: string;
  baseURL: string;
  endpoint: string;
  apiKey: string;
};

type DeleteTarget =
  | { kind: "provider"; providerId: string }
  | { kind: "model"; providerId: string; modelId: string };

type ModelDraft = {
  id: string;
  name: string;
  modelID: string;
  context: string;
  output: string;
};

type Props = {
  locale: ProviderLocale;
  workspace: string;
  effectiveCatalog: ProviderCatalog;
  selectedModelRef: string;
  onSelectedModelRef: (value: string) => void;
  onEffectiveCatalogChange: (catalog: ProviderCatalog) => void;
  onError: (message: string) => void;
};

const emptyProvider: ProviderDraft = {
  id: "",
  name: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
};

const emptyModel: ModelDraft = {
  id: "",
  name: "",
  modelID: "",
  context: "",
  output: "",
};

function cloneCatalog(catalog: ProviderCatalog): ProviderCatalog {
  return JSON.parse(JSON.stringify(catalog)) as ProviderCatalog;
}

function providerToDraft(id: string, provider: ProviderDefinition): ProviderDraft {
  return {
    id,
    name: provider.name || "",
    baseURL: provider.settings?.baseURL || "",
    endpoint: provider.settings?.endpoint || "",
    apiKey: provider.settings?.apiKey || "",
  };
}

function modelToDraft(id: string, model: ProviderModel): ModelDraft {
  return {
    id,
    name: model.name || "",
    modelID: model.modelID || "",
    context: model.limit?.context ? String(model.limit.context) : "",
    output: model.limit?.output ? String(model.limit.output) : "",
  };
}

function modelFromDraft(draft: ModelDraft): ProviderModel {
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

export function ProviderSettingsPanel({
  locale,
  workspace,
  effectiveCatalog,
  selectedModelRef,
  onSelectedModelRef,
  onEffectiveCatalogChange,
  onError,
}: Props) {
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
    [catalog]
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
        Object.keys(provider.models || {}).map((modelId) => providerId + "/" + modelId)
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

  function startAddProvider() {
    setProviderDraft(emptyProvider);
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

    const next = cloneCatalog(catalog);
    const previousId = editingProvider && editingProvider !== "new" ? editingProvider : null;
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
        apiKey: providerDraft.apiKey.trim() || undefined,
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

  async function saveAdvancedJSON() {
    try {
      const parsed = JSON.parse(advancedJSON) as ProviderCatalog;
      parsed.providers ||= {};
      await saveCatalog(parsed);
    } catch (err) {
      onError(String(err));
    }
  }

  return (
    <div className="provider-settings">
      <div className="provider-settings-header">
        <div>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        <button className="provider-primary-button" type="button" onClick={startAddProvider}>
          <Plus size={14} strokeWidth={1.8} aria-hidden />
          {t.addProvider}
        </button>
      </div>

      <div className="provider-scope-bar">
        <button
          type="button"
          className={scope === "global" ? "active" : ""}
          onClick={() => setScope("global")}
        >
          <span>{t.global}</span>
          <small>{t.globalHint}</small>
        </button>
        <button
          type="button"
          disabled={!workspace}
          className={scope === "workspace" ? "active" : ""}
          onClick={() => workspace && setScope("workspace")}
        >
          <span>{t.project}</span>
          <small>{t.projectHint}</small>
        </button>
        <code>{scope === "global" ? t.globalPath : t.projectPath}</code>
      </div>

      {loading ? (
        <div className="provider-loading">{t.loading}</div>
      ) : (
        <>
          {editingProvider === "new" && (
            <ProviderForm
              t={t}
              draft={providerDraft}
              onChange={setProviderDraft}
              onSave={() => void commitProvider()}
              onCancel={() => {
                setEditingProvider(null);
                setProviderDraft(emptyProvider);
              }}
              saving={saving}
            />
          )}

          {!providers.length && editingProvider !== "new" ? (
            <div className="provider-empty">
              <Server size={22} strokeWidth={1.6} aria-hidden />
              <strong>{t.noProviders}</strong>
              <p>{scope === "workspace" ? t.emptyProjectScope : t.noProvidersBody}</p>
              <button type="button" onClick={startAddProvider}>
                <Plus size={14} strokeWidth={1.8} aria-hidden />
                {t.addProvider}
              </button>
            </div>
          ) : (
            <div className="provider-list">
              {providers.map(([providerId, provider]) => {
                const expanded = expandedProvider === providerId;
                const models = Object.entries(provider.models || {}).sort(([a], [b]) => a.localeCompare(b));
                return (
                  <section className="provider-card" key={providerId}>
                    <div className="provider-card-head">
                      <button
                        type="button"
                        className="provider-expand"
                        aria-expanded={expanded}
                        onClick={() => setExpandedProvider(expanded ? null : providerId)}
                      >
                        {expanded ? (
                          <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
                        ) : (
                          <ChevronRight size={15} strokeWidth={1.8} aria-hidden />
                        )}
                        <span className="provider-card-icon"><Server size={15} strokeWidth={1.7} aria-hidden /></span>
                        <span className="provider-card-copy">
                          <strong>{provider.name || providerId}</strong>
                          <small>
                            {providerId} · {provider.settings?.baseURL || t.openaiCompatible} · {models.length} {t.models}
                          </small>
                        </span>
                      </button>
                      <div className="provider-card-actions">
                        <button type="button" aria-label={t.edit} onClick={() => startEditProvider(providerId, provider)}>
                          <Pencil size={13} strokeWidth={1.7} aria-hidden />
                        </button>
                        <button type="button" className="danger" aria-label={t.remove} onClick={() => setDeleteTarget({ kind: "provider", providerId })}>
                          <Trash2 size={13} strokeWidth={1.7} aria-hidden />
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="provider-card-body">
                        {editingProvider === providerId && (
                          <ProviderForm
                            t={t}
                            draft={providerDraft}
                            onChange={setProviderDraft}
                            onSave={() => void commitProvider()}
                            onCancel={() => {
                              setEditingProvider(null);
                              setProviderDraft(emptyProvider);
                            }}
                            saving={saving}
                          />
                        )}

                        {models.map(([modelId, model]) => {
                          const ref = providerId + "/" + modelId;
                          const localDefault = catalog.model === ref;
                          const effectiveDefault = effectiveCatalog.model === ref;
                          const editing =
                            editingModel?.providerId === providerId && editingModel.modelId === modelId;
                          return (
                            <div className="provider-model-wrap" key={modelId}>
                              {editing ? (
                                <ModelForm
                                  t={t}
                                  draft={modelDraft}
                                  onChange={setModelDraft}
                                  onSave={() => void commitModel()}
                                  onCancel={() => setEditingModel(null)}
                                  saving={saving}
                                />
                              ) : (
                                <div className="provider-model-row">
                                  <span className="provider-model-icon"><Code2 size={14} strokeWidth={1.7} aria-hidden /></span>
                                  <div className="provider-model-copy">
                                    <div>
                                      <strong>{model.name || modelId}</strong>
                                      {localDefault && <span className="provider-default-badge">{t.default}</span>}
                                      {!localDefault && effectiveDefault && (
                                        <span className="provider-effective-badge">{t.effectiveDefault}</span>
                                      )}
                                    </div>
                                    <small>
                                      {model.modelID || modelId}
                                      {model.limit?.context ? " · " + Math.round(model.limit.context / 1024) + "K ctx" : ""}
                                      {model.limit?.output ? " · " + Math.round(model.limit.output / 1024) + "K out" : ""}
                                    </small>
                                  </div>
                                  <div className="provider-model-actions">
                                    <button
                                      type="button"
                                      className={localDefault ? "selected" : ""}
                                      title={t.setDefault}
                                      aria-label={t.setDefault}
                                      onClick={() => void setDefaultModel(providerId, modelId)}
                                    >
                                      <Star size={13} strokeWidth={1.7} fill={localDefault ? "currentColor" : "none"} aria-hidden />
                                    </button>
                                    <button type="button" aria-label={t.edit} onClick={() => startEditModel(providerId, modelId, model)}>
                                      <Pencil size={13} strokeWidth={1.7} aria-hidden />
                                    </button>
                                    <button type="button" className="danger" aria-label={t.remove} onClick={() => setDeleteTarget({ kind: "model", providerId, modelId })}>
                                      <Trash2 size={13} strokeWidth={1.7} aria-hidden />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {!models.length && !editingModel && (
                          <div className="provider-no-models">{t.noModels}</div>
                        )}

                        {editingModel?.providerId === providerId && !editingModel.modelId && (
                          <ModelForm
                            t={t}
                            draft={modelDraft}
                            onChange={setModelDraft}
                            onSave={() => void commitModel()}
                            onCancel={() => setEditingModel(null)}
                            saving={saving}
                          />
                        )}

                        <button className="provider-add-model" type="button" onClick={() => startAddModel(providerId)}>
                          <Plus size={13} strokeWidth={1.8} aria-hidden />
                          {t.addModel}
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          <div className="provider-advanced">
            <button
              type="button"
              className="provider-advanced-toggle"
              aria-expanded={advancedOpen}
              onClick={() => {
                setAdvancedOpen((value) => !value);
                if (!advancedOpen && !advancedDirty) {
                  setAdvancedJSON(JSON.stringify(catalog, null, 2));
                }
              }}
            >
              {advancedOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
              <FileJson2 size={14} strokeWidth={1.7} aria-hidden />
              {t.advanced}
            </button>
            {advancedOpen && (
              <div className="provider-advanced-body">
                <p>{t.advancedHint}</p>
                <textarea
                  value={advancedJSON}
                  onChange={(event) => {
                    setAdvancedJSON(event.target.value);
                    setAdvancedDirty(true);
                  }}
                  spellCheck={false}
                />
                <div className="provider-advanced-footer">
                  <span>{t.inherited}</span>
                  <button type="button" disabled={!advancedDirty || saving} onClick={() => void saveAdvancedJSON()}>
                    {t.saveJson}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog
        open={deleteTarget !== null}
        title={t.remove}
        description={deleteTarget?.kind === "provider" ? t.deleteProviderConfirm : t.deleteModelConfirm}
        onOpenChange={(open) => {
          if (!open && !saving) setDeleteTarget(null);
        }}
        footer={
          <>
            <button
              type="button"
              className="provider-dialog-button secondary"
              disabled={saving}
              onClick={() => setDeleteTarget(null)}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              className="provider-dialog-button danger"
              disabled={saving}
              onClick={() => {
                if (!deleteTarget) return;
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target.kind === "provider") {
                  void removeProvider(target.providerId);
                } else {
                  void removeModel(target.providerId, target.modelId);
                }
              }}
            >
              {t.remove}
            </button>
          </>
        }
      />
    </div>
  );
}

function ProviderForm({
  t,
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  t: (typeof providerCopy)[ProviderLocale];
  draft: ProviderDraft;
  onChange: (draft: ProviderDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="provider-form">
      <div className="provider-form-grid">
        <label>
          <span>{t.providerId}</span>
          <input value={draft.id} onChange={(event) => onChange({ ...draft, id: event.target.value })} placeholder="deepseek" />
        </label>
        <label>
          <span>{t.providerName}</span>
          <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="DeepSeek" />
        </label>
        <label className="provider-form-wide">
          <span>{t.baseUrl}</span>
          <input value={draft.baseURL} onChange={(event) => onChange({ ...draft, baseURL: event.target.value })} placeholder="https://api.deepseek.com/v1" />
        </label>
        <label className="provider-form-wide">
          <span>{t.endpoint}</span>
          <input value={draft.endpoint} onChange={(event) => onChange({ ...draft, endpoint: event.target.value })} placeholder="https://example.com/v1/chat/completions" />
        </label>
        <label className="provider-form-wide">
          <span>{t.apiKey}</span>
          <input value={draft.apiKey} onChange={(event) => onChange({ ...draft, apiKey: event.target.value })} placeholder={t.apiKeyPlaceholder} autoComplete="off" />
          <small>{t.envHint}</small>
        </label>
        <label>
          <span>{t.package}</span>
          <input value={t.openaiCompatible} disabled />
        </label>
      </div>
      <div className="provider-form-actions">
        <button type="button" className="secondary" onClick={onCancel}>{t.cancel}</button>
        <button type="button" className="primary" disabled={saving} onClick={onSave}>{t.save}</button>
      </div>
    </div>
  );
}

function ModelForm({
  t,
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  t: (typeof providerCopy)[ProviderLocale];
  draft: ModelDraft;
  onChange: (draft: ModelDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="provider-model-form">
      <div className="provider-model-form-grid">
        <label>
          <span>{t.modelId}</span>
          <input value={draft.id} onChange={(event) => onChange({ ...draft, id: event.target.value })} placeholder="coder" />
        </label>
        <label>
          <span>{t.modelName}</span>
          <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="DeepSeek Coder" />
        </label>
        <label className="provider-model-form-wide">
          <span>{t.upstreamModelId}</span>
          <input value={draft.modelID} onChange={(event) => onChange({ ...draft, modelID: event.target.value })} placeholder="deepseek-chat" />
        </label>
        <label>
          <span>{t.context}</span>
          <input inputMode="numeric" value={draft.context} onChange={(event) => onChange({ ...draft, context: event.target.value })} placeholder="65536" />
        </label>
        <label>
          <span>{t.output}</span>
          <input inputMode="numeric" value={draft.output} onChange={(event) => onChange({ ...draft, output: event.target.value })} placeholder="8192" />
        </label>
      </div>
      <div className="provider-form-actions">
        <button type="button" className="secondary" onClick={onCancel}>{t.cancel}</button>
        <button type="button" className="primary" disabled={saving} onClick={onSave}>{t.save}</button>
      </div>
    </div>
  );
}
