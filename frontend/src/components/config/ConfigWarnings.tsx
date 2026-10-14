import { ShieldCheck } from "lucide-react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { ConfigWarning } from "../../types";
import { viewWarnings } from "./config-warnings";
import "./config-warnings.css";

type Props = {
  labels: AppCopy;
  warnings: ConfigWarning[];
  trusting: boolean;
  // default_limit is informational; the composer surfaces leave it to the provider panel.
  hideDefaultLimit?: boolean;
  onTrust: () => void;
};

export function ConfigWarnings({ labels, warnings, trusting, hideDefaultLimit = false, onTrust }: Props) {
  const view = viewWarnings(labels, warnings, hideDefaultLimit);
  if (!view.untrustedKeys.length && !view.lines.length) return null;

  return (
    <section className="config-warnings" role="status" aria-label={labels.configWarningsTitle}>
      {view.untrustedKeys.length > 0 && (
        <div className="config-warning-untrusted">
          <p>{labels.configWarningUntrusted}</p>
          <ul>
            {view.untrustedKeys.map((key) => <li key={key}><code>{key}</code></li>)}
          </ul>
          {view.trustable && (
            <div className="config-warning-actions">
              <button type="button" disabled={trusting} onClick={onTrust}>
                <ShieldCheck size={13} strokeWidth={1.7} aria-hidden />
                {trusting ? labels.configTrusting : labels.configTrustWorkspace}
              </button>
              <small>{labels.configTrustHint}</small>
            </div>
          )}
        </div>
      )}
      {view.lines.length > 0 && (
        <ul className="config-warning-lines">
          {view.lines.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      )}
    </section>
  );
}
