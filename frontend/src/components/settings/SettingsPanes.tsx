import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import type { ThemePreference } from "../../lib/theme";
import type { ConfigState, Health } from "../../types";
import { AppIcon, BrandMark, LumenIndicator } from "../brand/A1Mark";
import { ConfigWarnings } from "../config/ConfigWarnings";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";

export function GeneralPane({ locale, labels, themePreference, config, onLocaleChange, onThemePreferenceChange, onOpenModels }: {
  locale: Locale;
  labels: AppCopy;
  themePreference: ThemePreference;
  config: ConfigState;
  onLocaleChange: (locale: Locale) => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  onOpenModels: () => void;
}) {
  const themeOption = (value: ThemePreference, icon: "system" | "light" | "dark", label: string) => ({
    value,
    title: label,
    label: <><Icon name={icon} size={14} />{label}</>,
  });
  return (
    <div className="pane">
      <section className="pane-section">
        <h4>{labels.appearance}</h4>
        <div className="setting-row">
          <span>{labels.appearance}</span>
          <SegmentedControl
            ariaLabel={labels.appearance}
            value={themePreference}
            onChange={onThemePreferenceChange}
            options={[
              themeOption("system", "system", labels.appearanceSystem),
              themeOption("light", "light", labels.appearanceLight),
              themeOption("dark", "dark", labels.appearanceDark),
            ]}
          />
        </div>
        <div className="setting-row">
          <span>{labels.languageLabel}</span>
          <SegmentedControl
            ariaLabel={labels.languageLabel}
            value={locale}
            onChange={onLocaleChange}
            options={[{ value: "zh-CN", label: "简体中文" }, { value: "en", label: "English" }]}
          />
        </div>
      </section>
      <section className="pane-section">
        <h4>{labels.settingsDefaults}</h4>
        <div className="setting-row">
          <span>{labels.settingsDefaultModel}</span>
          <span className="setting-value">
            <span className="mono">{config.model || labels.settingsNoDefaultModel}</span>
            <Button size="sm" variant="ghost" onClick={onOpenModels}>{labels.settingsModels}</Button>
          </span>
        </div>
      </section>
    </div>
  );
}

export function WorkspacePane({ labels, workspace, config, trusting, onTrust }: {
  labels: AppCopy;
  workspace: string;
  config: ConfigState;
  trusting: boolean;
  onTrust: () => void;
}) {
  if (!workspace) return <p className="pane-intro">{labels.settingsNoProject}</p>;
  return (
    <div className="pane">
      <div className={`trust-card ${config.trusted ? "is-trusted" : ""}`}>
        <Icon name={config.trusted ? "verified" : "lock"} size={18} />
        <div>
          <strong>{config.trusted ? labels.settingsTrusted : labels.settingsUntrusted}</strong>
          <p>{config.trusted ? labels.settingsTrustedBody : labels.settingsUntrustedBody}</p>
          <p className="mono muted">{workspace}</p>
          {!config.trusted && (
            <div className="editor-actions">
              <Button size="sm" variant="primary" disabled={trusting} onClick={onTrust}>
                {trusting ? labels.configTrusting : labels.configTrustWorkspace}
              </Button>
            </div>
          )}
          <p className="muted">{labels.configTrustHint}</p>
        </div>
      </div>
      <ConfigWarnings labels={labels} warnings={config.warnings} trusting={trusting} onTrust={onTrust} />
      {config.globalPath && (
        <section className="pane-section">
          <h4>{labels.settingsGlobalConfig}</h4>
          <p className="mono muted">{config.globalPath}</p>
        </section>
      )}
    </div>
  );
}

export function AboutPane({ labels, health, workspace }: { labels: AppCopy; health?: Health; workspace: string }) {
  return (
    <div className="pane about-pane">
      <section className="about-hero">
        <AppIcon size={96} />
        <div>
          <h4>LumenCortex</h4>
          <p className="muted">{labels.tagline}</p>
        </div>
      </section>
      <section className="pane-section">
        <div className="setting-row"><span>{labels.aboutVersion}</span><span className="mono muted">{health?.version || "—"}</span></div>
        <div className="setting-row"><span>{labels.aboutWorkspace}</span><span className="mono muted">{workspace || "—"}</span></div>
        <div className="setting-row"><span>{labels.aboutDatabase}</span><span className="mono muted">{health?.database || "—"}</span></div>
      </section>
      <section className="pane-section">
        <h4>{labels.aboutIdentity}</h4>
        <p className="pane-intro">{labels.aboutIdentityNote}</p>
        <div className="icon-specimens">
          <figure><AppIcon size={128} /><figcaption>128</figcaption></figure>
          <figure className="small"><AppIcon size={64} /><AppIcon size={32} /><AppIcon size={16} /><figcaption>64 · 32 · 16</figcaption></figure>
          <figure className="small mark"><BrandMark size={48} variant="glass" /><BrandMark size={20} /><LumenIndicator size={20} /><figcaption>glass · flat · running</figcaption></figure>
        </div>
      </section>
    </div>
  );
}
