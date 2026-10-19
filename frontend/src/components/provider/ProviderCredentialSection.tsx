import { useEffect, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { CredentialStatus, ProviderCatalogScope } from "../../types";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { providerCopy, type ProviderLocale } from "./provider-copy";

type CredentialSource = "env" | "stored";

type Props = {
  locale: ProviderLocale;
  scope: ProviderCatalogScope;
  providerId: string;
  testing: boolean;
  onTestConnection: () => void;
  onCatalogChanged: () => void;
};

/**
 * Per-provider API key management for an existing provider: the {env:NAME} status and the
 * direct-input flow (the backend keeps the value in a local credentials file and the config
 * keeps only a {secret:NAME} reference). The typed key lives only in this component's input
 * state, travels to Go exactly once as the SaveProviderCredential argument, and is cleared
 * after every save attempt; nothing here ever renders, returns or logs a key value.
 */
export function ProviderCredentialSection({
  locale,
  scope,
  providerId,
  testing,
  onTestConnection,
  onCatalogChanged,
}: Props) {
  const t = providerCopy[locale];
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [source, setSource] = useState<CredentialSource>("env");
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [actionError, setActionError] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Guards a response landing after the user switched provider or scope mid-flight.
  const target = `${scope}:${providerId}`;
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
    let cancelled = false;
    setStatus(null);
    setLoadFailed(false);
    setKeyInput("");
    setActionError("");
    setConfirmingRemove(false);
    bridge.providerCredentialStatus(scope, providerId)
      .then((next) => {
        if (cancelled || targetRef.current !== target) return;
        setStatus(next);
        setSource(next.source === "stored" ? "stored" : "env");
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, providerId, target]);

  const hasStoredRef = status?.source === "stored";

  async function saveKey() {
    const value = keyInput.trim();
    if (!value || busy) return;
    setBusy("save");
    setActionError("");
    try {
      const next = await bridge.saveProviderCredential(scope, providerId, value);
      if (targetRef.current === target) {
        setStatus(next);
        setSource(next.source === "stored" ? "stored" : "env");
        setConfirmingRemove(false);
        onCatalogChanged();
      }
    } catch {
      // Deliberately generic: the backend's error text is dropped, never surfaced.
      if (targetRef.current === target) setActionError(t.keySaveFailed);
    } finally {
      // The key leaves with the call — success or failure, the input is emptied.
      if (targetRef.current === target) setKeyInput("");
      setBusy(null);
    }
  }

  async function removeKey() {
    if (busy) return;
    setBusy("remove");
    setActionError("");
    try {
      const next = await bridge.removeProviderCredential(scope, providerId);
      if (targetRef.current === target) {
        setStatus(next);
        setSource(next.source === "stored" ? "stored" : "env");
        setConfirmingRemove(false);
        onCatalogChanged();
      }
    } catch {
      if (targetRef.current === target) setActionError(t.keyRemoveFailed);
    } finally {
      setBusy(null);
    }
  }

  const envName = status?.ref?.startsWith("{env:") ? status.ref.slice(5, -1) : "";
  const statusText = loadFailed
    ? t.statusLoadFailed
    : status === null
      ? ""
      : status.source === "stored"
        ? t.keySaved
        : status.source === "env"
          ? (status.set ? t.keyEnvSet : t.keyEnvUnset).replace("{name}", envName)
          : t.keyNone;

  const testButton = (
    <Button
      variant="secondary"
      size="sm"
      icon={<Icon name="retry" size={13} />}
      disabled={testing || busy !== null}
      onClick={onTestConnection}
    >
      {t.testConnection}
    </Button>
  );

  return (
    <section className="provider-credential" aria-label={t.apiKeySection}>
      <div className="provider-credential-head">
        <h5 className="subhead">{t.apiKeySection}</h5>
        <p className="provider-credential-status" aria-live="polite">{statusText}</p>
      </div>
      <SegmentedControl
        ariaLabel={t.credentialSource}
        size="sm"
        value={source}
        onChange={setSource}
        options={[
          { value: "env", label: t.sourceEnv, title: t.sourceEnv },
          { value: "stored", label: t.sourceStored, title: t.sourceStored },
        ]}
      />
      {source === "env" ? (
        <div className="provider-credential-body">
          <p className="provider-credential-hint">{t.envSourceHint}</p>
          {testButton}
        </div>
      ) : (
        <div className="provider-credential-body">
          <input
            className="input mono"
            type="password"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder={hasStoredRef ? t.keyMasked : t.keyInputPlaceholder}
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            aria-label={t.apiKeySection}
            disabled={busy !== null}
          />
          <div className="provider-credential-actions">
            <Button
              variant="primary"
              size="sm"
              disabled={busy !== null || keyInput.trim() === ""}
              onClick={() => void saveKey()}
            >
              {hasStoredRef ? t.replaceKey : t.save}
            </Button>
            {hasStoredRef && !confirmingRemove && (
              <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setConfirmingRemove(true)}>
                {t.removeKey}
              </Button>
            )}
            {hasStoredRef && confirmingRemove && (
              <>
                <span className="provider-credential-confirm">{t.confirmRemoveKey}</span>
                <Button variant="danger" size="sm" disabled={busy !== null} onClick={() => void removeKey()}>
                  {t.confirmRemoveKeyAction}
                </Button>
                <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setConfirmingRemove(false)}>
                  {t.cancel}
                </Button>
              </>
            )}
            {testButton}
          </div>
          <p className="provider-credential-hint">{t.storedHint}</p>
        </div>
      )}
      {actionError && <p className="provider-credential-error" role="alert">{actionError}</p>}
    </section>
  );
}
