import { useEffect, useState, type ChangeEvent } from "react";
import { bridge } from "../../lib/bridge";
import { coreErrorKey } from "../../lib/core-errors";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import type { ThemePreference } from "../../lib/theme";
import type { AgentConcurrency, ConfigState, Health } from "../../types";
import { AppIcon, BrandMark, LumenIndicator } from "../brand/A1Mark";
import { ConfigWarnings } from "../config/ConfigWarnings";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";

export function GeneralPane({ locale, labels, themePreference, config, onLocaleChange, onThemePreferenceChange, onOpenModels, onConfigChanged, onError }: {
  locale: Locale;
  labels: AppCopy;
  themePreference: ThemePreference;
  config: ConfigState;
  onLocaleChange: (locale: Locale) => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  onOpenModels: () => void;
  onConfigChanged: () => void;
  onError: (message: string) => void;
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
      <ConcurrencySection labels={labels} config={config} onConfigChanged={onConfigChanged} onError={onError} />
    </div>
  );
}

const fill = (template: string, value: number) => template.replace("{value}", String(value));

// Agent concurrency lives in the global lumencortex.json (ADR-0008). Core reads it at every run
// start, so a saved change applies to the next agent without reopening the project.
export function ConcurrencySection({ labels, config, onConfigChanged, onError }: {
  labels: AppCopy;
  config: ConfigState;
  onConfigChanged: () => void;
  onError: (message: string) => void;
}) {
  const state = config.concurrency;
  // The draft keeps the typed text, so a field can be cleared and retyped; it is clamped on blur.
  const [draft, setDraft] = useState<Record<keyof AgentConcurrency, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const currentAgents = state.current.maxAgents;
  const currentChildren = state.current.maxChildrenPerParent;
  // A reloaded configuration (this save, or another window's) replaces the draft.
  useEffect(() => setDraft(null), [currentAgents, currentChildren]);
  // The placeholder before Core's first answer has no bounds to edit against.
  if (state.max.maxAgents < 1) return null;

  const keys: (keyof AgentConcurrency)[] = ["maxAgents", "maxChildrenPerParent"];
  const text = (key: keyof AgentConcurrency) => (draft ? draft[key] : String(state.current[key]));
  const valid = (key: keyof AgentConcurrency) => {
    const n = Number(text(key));
    return text(key).trim() !== "" && Number.isInteger(n) && n >= 1 && n <= state.max[key];
  };
  const allValid = keys.every(valid);
  const value: AgentConcurrency = { maxAgents: Number(text("maxAgents")), maxChildrenPerParent: Number(text("maxChildrenPerParent")) };
  const same = (a: AgentConcurrency, b: AgentConcurrency) =>
    a.maxAgents === b.maxAgents && a.maxChildrenPerParent === b.maxChildrenPerParent;
  const texts = () => ({ maxAgents: text("maxAgents"), maxChildrenPerParent: text("maxChildrenPerParent") });
  const change = (key: keyof AgentConcurrency) => (event: ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...texts(), [key]: event.target.value });
  const clamp = (key: keyof AgentConcurrency) => () => {
    const raw = text(key).trim();
    const n = Math.round(Number(raw));
    const next = raw === "" || !Number.isFinite(n) ? state.current[key] : Math.min(Math.max(n, 1), state.max[key]);
    setDraft({ ...texts(), [key]: String(next) });
  };
  const save = async () => {
    setSaving(true);
    try {
      await bridge.saveConcurrency(config.globalDigest, value);
      onConfigChanged();
    } catch (err) {
      const message = String(err);
      // Core wrote nothing on a conflict: reload so the user decides against the current file.
      if (coreErrorKey(message) === "conflict") onConfigChanged();
      onError(message);
    } finally {
      setSaving(false);
    }
  };
  const row = (key: keyof AgentConcurrency, label: string, hint: string) => (
    <label className="setting-row">
      <span className="setting-list-main">
        <span>{label}</span>
        <span className="pane-hint">{fill(hint, state.default[key])}</span>
      </span>
      <input
        className="input concurrency-input"
        type="number"
        min={1}
        max={state.max[key]}
        step={1}
        aria-label={label}
        aria-invalid={!valid(key)}
        value={text(key)}
        onChange={change(key)}
        onBlur={clamp(key)}
      />
    </label>
  );

  return (
    <section className="pane-section" aria-labelledby="settings-concurrency">
      <h4 id="settings-concurrency">{labels.settingsConcurrency}</h4>
      {row("maxAgents", labels.settingsMaxAgents, labels.settingsMaxAgentsHint)}
      {row("maxChildrenPerParent", labels.settingsMaxChildren, labels.settingsMaxChildrenHint)}
      <p className="pane-hint">{labels.settingsConcurrencyNote}</p>
      <div className="editor-actions">
        <Button
          size="sm"
          variant="ghost"
          disabled={saving || (allValid && same(value, state.default))}
          onClick={() => setDraft({ maxAgents: String(state.default.maxAgents), maxChildrenPerParent: String(state.default.maxChildrenPerParent) })}
        >
          {labels.settingsConcurrencyDefaults}
        </Button>
        <Button size="sm" variant="primary" disabled={saving || !allValid || same(value, state.current)} onClick={() => void save()}>
          {labels.save}
        </Button>
      </div>
    </section>
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
