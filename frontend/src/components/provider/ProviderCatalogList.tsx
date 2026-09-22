import {
  ChevronDown,
  ChevronRight,
  Code2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Star,
  Trash2,
  Wifi,
} from "lucide-react";
import type { ProviderCatalog } from "../../types";
import { ModelForm, ProviderForm } from "./ProviderForms";
import { providerCopy, type ProviderLocale } from "./provider-copy";
import { emptyProvider } from "./provider-settings-model";
import type { useProviderSettingsController } from "./useProviderSettingsController";

type Props = {
  locale: ProviderLocale;
  effectiveCatalog: ProviderCatalog;
  controller: ReturnType<typeof useProviderSettingsController>;
};

export function ProviderCatalogList({ locale, effectiveCatalog, controller }: Props) {
  const t = providerCopy[locale];
  const {
    scope,
    catalog,
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
    setDeleteTarget,
    providerAction,
    providerNotice,
    startAddProvider,
    startEditProvider,
    commitProvider,
    startAddModel,
    startEditModel,
    commitModel,
    setDefaultModel,
    testConnection,
    discoverModels,
  } = controller;

  return (
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
          <button type="button" onClick={() => startAddProvider()}>
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
                    <button
                      type="button"
                      aria-label={t.testConnection}
                      title={t.testConnection}
                      disabled={providerAction !== null}
                      onClick={() => void testConnection(providerId)}
                    >
                      <Wifi size={13} strokeWidth={1.7} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t.discoverModels}
                      title={t.discoverModels}
                      disabled={providerAction !== null}
                      onClick={() => void discoverModels(providerId)}
                    >
                      <RefreshCw size={13} strokeWidth={1.7} aria-hidden />
                    </button>
                    <button type="button" aria-label={t.edit} onClick={() => startEditProvider(providerId, provider)}>
                      <Pencil size={13} strokeWidth={1.7} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="danger"
                      aria-label={t.remove}
                      onClick={() => setDeleteTarget({ kind: "provider", providerId })}
                    >
                      <Trash2 size={13} strokeWidth={1.7} aria-hidden />
                    </button>
                  </div>
                </div>

                {providerNotice[providerId] && (
                  <div className="provider-action-notice">{providerNotice[providerId]}</div>
                )}

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
                                <button
                                  type="button"
                                  aria-label={t.edit}
                                  onClick={() => startEditModel(providerId, modelId, model)}
                                >
                                  <Pencil size={13} strokeWidth={1.7} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  aria-label={t.remove}
                                  onClick={() => setDeleteTarget({ kind: "model", providerId, modelId })}
                                >
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
    </>
  );
}
