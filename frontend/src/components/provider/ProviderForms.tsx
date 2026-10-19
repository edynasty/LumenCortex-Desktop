import { Button } from "../primitives/Button";
import { SegmentedControl } from "../primitives/SegmentedControl";
import type { ProviderLocale } from "./provider-copy";
import { providerCopy } from "./provider-copy";
import { envNameValid, type ModelDraft, type ProviderDraft } from "./provider-settings-model";

export function ProviderForm({
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
  const anthropic = draft.package === "anthropic-messages";
  // A literal key pasted into the env-name field: refused before anything is saved.
  const envInvalid = !envNameValid(draft.apiKey);
  return (
    <div className="provider-form">
      <div className="form-grid">
        <label className="field">
          <span className="field-label">{t.providerId}</span>
          <input className="input" value={draft.id} onChange={(event) => onChange({ ...draft, id: event.target.value })} placeholder="deepseek" />
        </label>
        <label className="field">
          <span className="field-label">{t.providerName}</span>
          <input className="input" value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="DeepSeek" />
        </label>
        <div className="field span-2">
          <span className="field-label">{t.package}</span>
          <SegmentedControl
            ariaLabel={t.package}
            size="sm"
            value={draft.package}
            onChange={(value) => onChange({ ...draft, package: value })}
            options={[
              { value: "openai-compatible", label: t.openaiCompatible, title: t.openaiCompatible },
              { value: "anthropic-messages", label: t.anthropicMessages, title: t.anthropicMessages },
            ]}
          />
          <span className="field-help">{anthropic ? t.protocolHintAnthropic : t.protocolHintOpenai}</span>
        </div>
        <label className="field span-2">
          <span className="field-label">{t.baseUrl}</span>
          <input className="input mono" value={draft.baseURL} onChange={(event) => onChange({ ...draft, baseURL: event.target.value })} placeholder={anthropic ? t.anthropicBasePlaceholder : "https://api.deepseek.com/v1"} />
        </label>
        <label className="field span-2">
          <span className="field-label">{t.endpoint}</span>
          <input className="input mono" value={draft.endpoint} onChange={(event) => onChange({ ...draft, endpoint: event.target.value })} placeholder={anthropic ? t.anthropicEndpointPlaceholder : "https://example.com/v1/chat/completions"} />
          {anthropic && <span className="field-help">{t.endpointDefaultAnthropic}</span>}
        </label>
        <label className="field span-2">
          <span className="field-label">{t.apiKey}</span>
          <input
            className={`input mono${envInvalid ? " is-invalid" : ""}`}
            value={draft.apiKey}
            onChange={(event) => onChange({ ...draft, apiKey: event.target.value })}
            placeholder={t.apiKeyPlaceholder}
            autoComplete="off"
            aria-invalid={envInvalid || undefined}
          />
          {envInvalid ? (
            <span className="field-help is-error" role="alert">{t.invalidEnvName}</span>
          ) : (
            <span className="field-help">{t.envHint}</span>
          )}
        </label>
      </div>
      <div className="editor-actions">
        <Button variant="secondary" size="sm" onClick={onCancel}>{t.cancel}</Button>
        <Button variant="primary" size="sm" disabled={saving || envInvalid} onClick={onSave}>{t.save}</Button>
      </div>
    </div>
  );
}

export function ModelForm({
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
      <div className="form-grid">
        <label className="field">
          <span className="field-label">{t.modelId}</span>
          <input className="input" value={draft.id} onChange={(event) => onChange({ ...draft, id: event.target.value })} placeholder="coder" />
        </label>
        <label className="field">
          <span className="field-label">{t.modelName}</span>
          <input className="input" value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="DeepSeek Coder" />
        </label>
        <label className="field span-2">
          <span className="field-label">{t.upstreamModelId}</span>
          <input className="input mono" value={draft.modelID} onChange={(event) => onChange({ ...draft, modelID: event.target.value })} placeholder="deepseek-chat" />
        </label>
        <label className="field">
          <span className="field-label">{t.context}</span>
          <input className="input" inputMode="numeric" value={draft.context} onChange={(event) => onChange({ ...draft, context: event.target.value })} placeholder="65536" />
        </label>
        <label className="field">
          <span className="field-label">{t.output}</span>
          <input className="input" inputMode="numeric" value={draft.output} onChange={(event) => onChange({ ...draft, output: event.target.value })} placeholder="8192" />
        </label>
      </div>
      <div className="editor-actions">
        <Button variant="secondary" size="sm" onClick={onCancel}>{t.cancel}</Button>
        <Button variant="primary" size="sm" disabled={saving} onClick={onSave}>{t.save}</Button>
      </div>
    </div>
  );
}
