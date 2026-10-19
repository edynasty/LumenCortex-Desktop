import { useEffect, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { CredentialStatus, ProviderCatalogScope } from "../../types";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { providerCopy, type ProviderLocale } from "./provider-copy";

/** Matches a value that names an environment variable rather than a literal key. */
const ENV_VALUE_PATTERN = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$|^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/;

type Props = {
  locale: ProviderLocale;
  scope: ProviderCatalogScope;
  providerId: string;
  testing: boolean;
  onTestConnection: () => void;
  onCatalogChanged: () => void;
};

/**
 * Per-provider API key management for an existing provider: ONE field that accepts either a
 * literal key or an environment placeholder (`${NAME}` / `{env:NAME}`); the backend classifies
 * the value inside SaveProviderCredential (literal → stored in the local credentials file with
 * a {secret:NAME} reference; placeholder → an {env:NAME} reference in config, stored key
 * removed). A literal lives only in this component's input state, travels to Go exactly once
 * as the save argument, and is cleared after every save attempt; nothing here ever renders,
 * returns or logs a key value. A stored literal is never read back — the field shows only a
 * dot-mask placeholder while status.source is "stored".
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
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [actionError, setActionError] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Guards a response landing after the user switched provider or scope mid-flight.
  const target = `${scope}:${providerId}`;
  const targetRef = useRef(target);

  // While status.source is "env" the field holds the visible, non-secret reference text.
  const envRefText = status?.source === "env" && status.ref?.startsWith("{env:")
    ? "$" + "{" + status.ref.slice(5, -1) + "}"
    : "";
  const [edited, setEdited] = useState(false);
  const value = edited ? keyInput : envRefText;

  useEffect(() => {
    targetRef.current = target;
    let cancelled = false;
    setStatus(null);
    setLoadFailed(false);
    setKeyInput("");
    setEdited(false);
    setActionError("");
    setConfirmingRemove(false);
    bridge.providerCredentialStatus(scope, providerId)
      .then((next) => {
        if (cancelled || targetRef.current !== target) return;
        setStatus(next);
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
    const raw = value.trim();
    if (!raw || busy) return;
    setBusy("save");
    setActionError("");
    try {
      const next = await bridge.saveProviderCredential(scope, providerId, raw);
      if (targetRef.current === target) {
        setStatus(next);
        setConfirmingRemove(false);
        onCatalogChanged();
      }
    } catch {
      // Deliberately generic: the backend's error text is dropped, never surfaced.
      if (targetRef.current === target) setActionError(t.keySaveFailed);
    } finally {
      // The value leaves with the call — success or failure, the input is emptied.
      if (targetRef.current === target) {
        setKeyInput("");
        setEdited(false);
      }
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

  // A placeholder names a variable (plain text); anything else may be a literal (masked).
  const looksLikePlaceholder = ENV_VALUE_PATTERN.test(value.trim());
  const inputType = looksLikePlaceholder ? "text" : "password";
  const placeholder = hasStoredRef ? t.keyMasked : t.keyInputPlaceholder;

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

  function onInputChange(next: string) {
    setKeyInput(next);
    setEdited(true);
  }

  return (
    <section className="provider-credential" aria-label={t.apiKeySection}>
      <div className="provider-credential-head">
        <h5 className="subhead">{t.apiKeySection}</h5>
        <p className="provider-credential-status" aria-live="polite">{statusText}</p>
      </div>
      <div className="provider-credential-body">
        <input
          className="input mono"
          type={inputType}
          value={value}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={t.apiKeySection}
          disabled={busy !== null}
        />
        <div className="provider-credential-actions">
          <Button
            variant="primary"
            size="sm"
            disabled={busy !== null || value.trim() === ""}
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
        {actionError && <p className="provider-credential-error" role="alert">{actionError}</p>}
        <p className="provider-credential-hint">{t.storedHint}</p>
      </div>
    </section>
  );
}
