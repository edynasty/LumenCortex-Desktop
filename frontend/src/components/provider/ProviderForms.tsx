import type { ProviderLocale } from "./provider-copy";
import { providerCopy } from "./provider-copy";
import type { ModelDraft, ProviderDraft } from "./provider-settings-model";

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
