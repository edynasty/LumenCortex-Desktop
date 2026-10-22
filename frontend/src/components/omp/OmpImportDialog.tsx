import { useDeferredValue, useState } from "react";
import { useOmpImport } from "../../app/hooks/useOmpImport";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import { Modal } from "../primitives/Modal";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { OmpImportPreviewPane } from "./OmpImportPreviewPane";
import { OmpSessionList } from "./OmpSessionList";
import "./omp-import.css";

type Props = {
  open: boolean;
  labels: AppCopy;
  locale: Locale;
  onClose: () => void;
  // Called with the native session to open: the imported root, or the session an earlier import
  // wrote when the button says Open. The caller closes the dialog, refreshes the list and selects it.
  onImported: (sessionId: string) => void;
};

type Scope = "workspace" | "all";

// Import OMP sessions (ADR-0011): list this workspace's OMP sessions (or all), preview one and
// import its visible history as native sessions. Core decides everything the dialog shows; the
// dialog only chooses a session and asks for the import.
export function OmpImportDialog({ open, labels, locale, onClose, onImported }: Props) {
  const [scope, setScope] = useState<Scope>("workspace");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const omp = useOmpImport({ open, all: scope === "all", query });
  const alreadyImported = Boolean(omp.preview?.source.imported);

  async function submit() {
    const sessionId = await omp.runImport();
    if (sessionId) onImported(sessionId);
  }

  return (
    <Modal label={labels.ompImportTitle} onClose={onClose} className="omp-import-sheet" hidden={!open}>
      <header className="omp-import-head">
        <div className="omp-import-titles">
          <h2 className="dialog-title">{labels.ompImportTitle}</h2>
          <p className="dialog-lede">{labels.ompImportLede}</p>
        </div>
        <IconButton icon={<Icon name="close" size={14} />} label={labels.close} size="sm" onClick={onClose} />
      </header>

      <div className="omp-import-controls">
        <label className="search-field">
          <Icon name="search" size={13} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.ompImportSearch}
            aria-label={labels.ompImportSearch}
          />
        </label>
        <SegmentedControl<Scope>
          value={scope}
          ariaLabel={labels.ompImportScope}
          size="sm"
          options={[
            { value: "workspace", label: labels.ompImportThisWorkspace },
            { value: "all", label: labels.ompImportAllWorkspaces },
          ]}
          onChange={setScope}
        />
      </div>

      <div className="omp-import-body">
        <OmpSessionList
          sessions={omp.sessions}
          state={omp.listState}
          error={omp.listError}
          selected={omp.selected}
          labels={labels}
          locale={locale}
          onSelect={omp.select}
        />
        <OmpImportPreviewPane
          preview={omp.preview}
          state={omp.previewState}
          error={omp.previewError}
          labels={labels}
        />
      </div>

      {omp.importError && <p className="omp-import-error" role="alert">{omp.importError}</p>}

      <footer className="dialog-actions omp-import-actions">
        <p className="omp-safety">{labels.ompImportSafety}</p>
        <div className="omp-import-buttons">
          <Button variant="secondary" onClick={onClose}>{labels.cancel}</Button>
          <Button
            variant="primary"
            disabled={!omp.preview || omp.previewState !== "ready" || omp.importing}
            onClick={submit}
          >
            {omp.importing
              ? labels.ompImportImporting
              : alreadyImported
                ? labels.ompImportOpen
                : labels.ompImportAction}
          </Button>
        </div>
      </footer>
    </Modal>
  );
}
