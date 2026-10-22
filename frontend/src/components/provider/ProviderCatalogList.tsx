import { useState } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { ModelForm, ProviderForm } from "./ProviderForms";
import { providerCopy, type ProviderLocale } from "./provider-copy";
import { effortLabel } from "./provider-reasoning";
import { emptyProvider } from "./provider-settings-model";
import { ProviderCredentialSection } from "./ProviderCredentialSection";
import type { ProviderSettingsController } from "./useProviderSettingsController";

type Props = {
  locale: ProviderLocale;
  // The effort levels' names live in the app copy; the provider copy only names the fields.
  labels: AppCopy;
  effectiveModel: string;
  controller: ProviderSettingsController;
};

/** The provider list + the selected provider's editor, per the Demo Providers pane layout. */
export function ProviderCatalogList({ locale, labels, effectiveModel, controller }: Props) {
  const t = providerCopy[locale];
  const {
    catalog,
    saving,
    providers,
    editingProvider,
    setEditingProvider,
    providerDraft,
    setProviderDraft,
    editingModel,
    setEditingModel,
    modelDraft,
    setModelDraft,
    reasoningFormats,
    reasoningEfforts,
    modelError,
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

  const [selectedId, setSelectedId] = useState("");
  const selected = providers.find(([providerId]) => providerId === selectedId) ?? providers[0];
  const [selectedProviderId, provider] = selected ?? ["", undefined];
  const models = Object.entries(provider?.models || {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="provider-layout">
      <ul className="provider-list">
        {providers.map(([providerId, entry]) => (
          <li key={providerId}>
            <button
              type="button"
              className={`provider-row ${selectedProviderId === providerId && editingProvider !== "new" ? "is-selected" : ""}`}
              onClick={() => {
                setSelectedId(providerId);
                setEditingProvider(null);
              }}
            >
              <span className="provider-row-name">{entry.name || providerId}</span>
              <span className="provider-row-sub mono">
                {providerId} · {Object.keys(entry.models || {}).length} {t.models}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={`provider-row is-add ${editingProvider === "new" ? "is-selected" : ""}`}
            onClick={() => startAddProvider()}
          >
            <Icon name="create" size={14} />
            {t.addProvider}
          </button>
        </li>
      </ul>

      <div className="provider-editor">
        {editingProvider === "new" ? (
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
        ) : !provider ? (
          <div className="provider-empty">
            <Icon name="model" size={22} />
            <strong>{t.noProviders}</strong>
            <p>{t.noProvidersBody}</p>
            <Button variant="secondary" size="sm" icon={<Icon name="create" size={14} />} onClick={() => startAddProvider()}>
              {t.addProvider}
            </Button>
          </div>
        ) : (
          <>
            <div className="provider-editor-head">
              <div className="provider-editor-id">
                <strong>{provider.name || selectedProviderId}</strong>
                <span className="mono">
                  {selectedProviderId} · {provider.settings?.baseURL || t.openaiCompatible}
                </span>
              </div>
              <div className="provider-editor-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.testConnection}
                  title={t.testConnection}
                  disabled={providerAction !== null}
                  onClick={() => void testConnection(selectedProviderId)}
                >
                  <Icon name="retry" size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.discoverModels}
                  title={t.discoverModels}
                  disabled={providerAction !== null}
                  onClick={() => void discoverModels(selectedProviderId)}
                >
                  <Icon name="search" size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.edit}
                  title={t.edit}
                  onClick={() => startEditProvider(selectedProviderId, provider)}
                >
                  <Icon name="edit" size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="is-danger"
                  aria-label={t.remove}
                  title={t.remove}
                  onClick={() => setDeleteTarget({ kind: "provider", providerId: selectedProviderId })}
                >
                  <Icon name="delete" size={13} />
                </Button>
              </div>
            </div>

            {providerNotice[selectedProviderId] && (
              <div className="provider-action-notice">{providerNotice[selectedProviderId]}</div>
            )}

            {/* API key management (env reference + direct input): view mode only — the form's env-name field
                covers the create/edit flow, and the section writes the file itself. */}
            <ProviderCredentialSection
              locale={locale}
              scope={controller.scope}
              providerId={selectedProviderId}
              testing={providerAction === "test:" + selectedProviderId}
              onTestConnection={() => void testConnection(selectedProviderId)}
              onCatalogChanged={() => void controller.reloadCatalog()}
            />

            {editingProvider === selectedProviderId ? (
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
            ) : (
              <>
                <h5 className="subhead">{t.models}</h5>
                <ul className="provider-model-list">
                  {models.map(([modelId, model]) => {
                    const ref = `${selectedProviderId}/${modelId}`;
                    const localDefault = catalog.model === ref;
                    const effectiveDefault = effectiveModel === ref;
                    const editing =
                      editingModel?.providerId === selectedProviderId && editingModel.modelId === modelId;
                    return (
                      <li className="provider-model-row" key={modelId}>
                        {editing ? (
                          <ModelForm
                            t={t}
                            labels={labels}
                            formats={reasoningFormats}
                            efforts={reasoningEfforts}
                            error={modelError}
                            draft={modelDraft}
                            onChange={setModelDraft}
                            onSave={() => void commitModel()}
                            onCancel={() => setEditingModel(null)}
                            saving={saving}
                          />
                        ) : (
                          <>
                            <div className="provider-model-row-head">
                              <span className="provider-model-row-name">{model.name || modelId}</span>
                              <code className="mono provider-model-row-ref">{ref}</code>
                              {localDefault ? (
                                <span className="tag">{t.default}</span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={t.setDefault}
                                  aria-label={t.setDefault}
                                  onClick={() => void setDefaultModel(selectedProviderId, modelId)}
                                >
                                  {t.setDefault}
                                </Button>
                              )}
                              {effectiveDefault && !localDefault && (
                                <span className="badge tone-accent">{t.effectiveDefault}</span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="is-row-end is-danger"
                                aria-label={t.edit}
                                title={t.edit}
                                onClick={() => startEditModel(selectedProviderId, modelId, model)}
                              >
                                <Icon name="edit" size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="is-row-end is-danger"
                                aria-label={t.remove}
                                title={t.remove}
                                onClick={() => setDeleteTarget({ kind: "model", providerId: selectedProviderId, modelId })}
                              >
                                <Icon name="delete" size={13} />
                              </Button>
                            </div>
                            <dl className="provider-model-row-meta">
                              <div>
                                <dt>{t.upstreamModelId}</dt>
                                <dd className="mono" title={model.modelID || modelId}>{model.modelID || modelId}</dd>
                              </div>
                              {model.limit?.context ? (
                                <div>
                                  <dt>{t.context}</dt>
                                  <dd>{Math.round(model.limit.context / 1024)}K</dd>
                                </div>
                              ) : null}
                              {model.limit?.output ? (
                                <div>
                                  <dt>{t.output}</dt>
                                  <dd>{Math.round(model.limit.output / 1024)}K</dd>
                                </div>
                              ) : null}
                              <div>
                                <dt>{t.reasoningFormat}</dt>
                                <dd>
                                  {model.reasoning?.format || t.reasoningFormatDefault}
                                  {model.reasoning?.efforts?.length
                                    ? " · " + model.reasoning.efforts.map((level) => effortLabel(level, labels)).join(" / ")
                                    : ""}
                                </dd>
                              </div>
                            </dl>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {!models.length && !editingModel && <p className="provider-no-models">{t.noModels}</p>}

                {editingModel?.providerId === selectedProviderId && !editingModel.modelId && (
                  <ModelForm
                    t={t}
                    labels={labels}
                    formats={reasoningFormats}
                    efforts={reasoningEfforts}
                    error={modelError}
                    draft={modelDraft}
                    onChange={setModelDraft}
                    onSave={() => void commitModel()}
                    onCancel={() => setEditingModel(null)}
                    saving={saving}
                  />
                )}

                <button className="provider-add-model" type="button" onClick={() => startAddModel(selectedProviderId)}>
                  <Icon name="create" size={13} />
                  {t.addModel}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
