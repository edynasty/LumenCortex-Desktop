import type { OmpLoadState } from "../../app/hooks/useOmpImport";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { ompSessionTitle, ompStatRows, ompWarningText } from "../../lib/omp-import";
import type { ImportPreview } from "../../types";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
import { LoadingState } from "../primitives/LoadingState";

type Props = {
  preview: ImportPreview | null;
  state: OmpLoadState;
  error: string;
  labels: AppCopy;
};

function Excerpt({ label, text }: { label: string; text: string }) {
  return (
    <div className="omp-excerpt">
      <span className="section-label">{label}</span>
      <p>{text}</p>
    </div>
  );
}

// What importing the selected session would write: the goal, the model, the two ends of the
// conversation, every count Core computed, Core's warnings and what the import never does.
export function OmpImportPreviewPane({ preview, state, error, labels }: Props) {
  if (state === "error") {
    return (
      <div className="omp-preview-state">
        <EmptyState icon={<Icon name="failed" size={18} />} title={labels.ompImportPreviewError} body={error} compact />
      </div>
    );
  }
  if (!preview) {
    return (
      <div className="omp-preview-state">
        {state === "loading"
          ? <LoadingState label={labels.ompImportLoading} compact />
          : <EmptyState icon={<Icon name="history" size={18} />} title={labels.ompImportNoSelection} compact />}
      </div>
    );
  }

  const source = preview.source;
  const warnings = preview.warnings ?? [];
  return (
    <section className="omp-preview" aria-label={labels.ompImportPreview}>
      <header className="omp-preview-head">
        <h3>{preview.goal || ompSessionTitle(source)}</h3>
        <span className="omp-preview-path path" title={source.cwd}>{source.cwd}</span>
        {source.imported && (
          <p className="omp-preview-imported">
            <Icon name="checkmark" size={13} />
            <span>{labels.ompImportImportedHint}</span>
          </p>
        )}
      </header>

      {preview.model && (
        <div className="omp-preview-line">
          <span className="section-label">{labels.ompImportModel}</span>
          <span className="mono">{preview.model}</span>
        </div>
      )}
      {preview.firstUser && <Excerpt label={labels.ompImportFirstUser} text={preview.firstUser} />}
      {preview.lastAssistant && <Excerpt label={labels.ompImportLastAssistant} text={preview.lastAssistant} />}

      <div className="omp-counts">
        <span className="section-label">{labels.ompImportCounts}</span>
        <dl>
          {ompStatRows(preview, labels).map((row) => (
            <div key={row.key} className="omp-count">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {warnings.length > 0 && (
        <ul className="omp-warnings" aria-label={labels.ompImportWarnings}>
          {warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>
              <Icon name="stale" size={14} />
              <span>{ompWarningText(labels, warning)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
