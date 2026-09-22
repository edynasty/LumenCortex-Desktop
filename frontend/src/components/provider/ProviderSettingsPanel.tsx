import { ChevronDown, ChevronRight, FileJson2, Plus } from "lucide-react";
import { Dialog } from "../primitives/Dialog";
import type { ProviderCatalog } from "../../types";
import { ProviderCatalogList } from "./ProviderCatalogList";
import { providerCopy, type ProviderLocale } from "./provider-copy";
import { providerPresets } from "./provider-presets";
import { useProviderSettingsController } from "./useProviderSettingsController";
import "./provider-settings.css";

type Props = {
  locale: ProviderLocale;
  workspace: string;
  effectiveCatalog: ProviderCatalog;
  selectedModelRef: string;
  onSelectedModelRef: (value: string) => void;
  onEffectiveCatalogChange: (catalog: ProviderCatalog) => void;
  onError: (message: string) => void;
};

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
  const controller = useProviderSettingsController({
    locale,
    workspace,
    selectedModelRef,
    onSelectedModelRef,
    onEffectiveCatalogChange,
    onError,
  });

  const {
    scope,
    setScope,
    catalog,
    loading,
    saving,
    advancedOpen,
    setAdvancedOpen,
    advancedJSON,
    setAdvancedJSON,
    advancedDirty,
    setAdvancedDirty,
    deleteTarget,
    setDeleteTarget,
    startAddProvider,
    removeProvider,
    removeModel,
    saveAdvancedJSON,
  } = controller;

  return (
    <div className="provider-settings">
      <div className="provider-settings-header">
        <p>{t.subtitle}</p>
        <button className="provider-primary-button" type="button" onClick={() => startAddProvider()}>
          <Plus size={14} strokeWidth={1.8} aria-hidden />
          {t.addProvider}
        </button>
      </div>

      <div className="provider-presets" aria-label={t.presets}>
        <span>{t.presets}</span>
        {providerPresets.map((preset) => (
          <button key={preset.id} type="button" onClick={() => startAddProvider(preset)}>
            {preset.name}
          </button>
        ))}
        <button type="button" onClick={() => startAddProvider()}>{t.custom}</button>
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
          <ProviderCatalogList
            locale={locale}
            effectiveCatalog={effectiveCatalog}
            controller={controller}
          />

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
                  aria-label={t.advanced}
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
        closeLabel={t.close}
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
