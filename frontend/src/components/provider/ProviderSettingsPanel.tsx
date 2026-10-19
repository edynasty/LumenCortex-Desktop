import { Dialog } from "../primitives/Dialog";
import { copy } from "../../lib/i18n/app-copy";
import type { ConfigState } from "../../types";
import { ConfigWarnings } from "../config/ConfigWarnings";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { ProviderCatalogList } from "./ProviderCatalogList";
import { providerCopy, type ProviderLocale } from "./provider-copy";
import { providerPresets } from "./provider-presets";
import { useProviderSettingsController } from "./useProviderSettingsController";
import "./provider-settings.css";

type Props = {
  locale: ProviderLocale;
  workspace: string;
  config: ConfigState;
  trusting: boolean;
  onTrust: () => void;
  onConfigChanged: () => void;
  onError: (message: string) => void;
};

export function ProviderSettingsPanel({
  locale,
  workspace,
  config,
  trusting,
  onTrust,
  onConfigChanged,
  onError,
}: Props) {
  const t = providerCopy[locale];
  const controller = useProviderSettingsController({
    locale,
    workspace,
    onConfigChanged,
    onError,
  });

  const {
    scope,
    setScope,
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
    <div className="pane">
      <div className="pane-toolbar">
        <SegmentedControl
          ariaLabel={t.title}
          value={scope}
          onChange={setScope}
          options={[
            { value: "global", label: t.global, title: t.global },
            { value: "workspace", label: t.project, title: t.project, disabled: !workspace },
          ]}
        />
        <span className="pane-hint">
          {scope === "global" ? t.globalHint : t.projectHint}
          {" · "}
          <span className="mono">{scope === "global" ? t.globalPath : t.projectPath}</span>
        </span>
      </div>

      <ConfigWarnings labels={copy[locale]} warnings={config.warnings} trusting={trusting} onTrust={onTrust} />

      <div className="provider-presets" aria-label={t.presets}>
        <span>{t.presets}</span>
        {providerPresets.map((preset) => (
          <button key={preset.id} type="button" className="chip" onClick={() => startAddProvider(preset)}>
            <span className="chip-label">{preset.name}</span>
          </button>
        ))}
        <button type="button" className="chip" onClick={() => startAddProvider()}>
          <span className="chip-label">{t.custom}</span>
        </button>
      </div>

      {loading ? (
        <p className="pane-intro">{t.loading}</p>
      ) : (
        <>
          <ProviderCatalogList
            locale={locale}
            effectiveModel={config.model}
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
                  setAdvancedJSON(JSON.stringify(controller.catalog, null, 2));
                }
              }}
            >
              <Icon name={advancedOpen ? "collapse" : "expand"} size={14} />
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
                  <Button variant="secondary" size="sm" disabled={!advancedDirty || saving} onClick={() => void saveAdvancedJSON()}>
                    {t.saveJson}
                  </Button>
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
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => setDeleteTarget(null)}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
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
            </Button>
          </>
        }
      />
    </div>
  );
}
