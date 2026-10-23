import { useDeferredValue, useState } from "react";
import { useOmpImport } from "../../app/hooks/useOmpImport";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { Button } from "../primitives/Button";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import { Modal } from "../primitives/Modal";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { DesktopSelect } from "../primitives/Select";
import { OmpImportPreviewPane } from "./OmpImportPreviewPane";
import { OmpSessionList } from "./OmpSessionList";
import "./omp-import.css";

type Props = {
  open: boolean;
  labels: AppCopy;
  locale: Locale;
  /** The source the opening entry named; the dialog preselects it when Core runs it. */
  initialSourceId?: string;
  onClose: () => void;
  // Called with the native session to open: the imported root, or the session an earlier import
  // wrote when the button says Open. The caller closes the dialog, refreshes the list and selects it.
  onImported: (sessionId: string) => void;
  // Opens Settings → Plugins, where a disabled import plugin is enabled again. Without it the empty
  // state still names the path.
  onOpenPlugins?: () => void;
};

type Scope = "workspace" | "all";

// Import sessions of another agent runtime (ADR-0012): list the chosen source's sessions of this
// workspace (or all), preview one and import its visible history as native sessions. Core decides
// everything the dialog shows; the dialog only chooses a source and a session and asks for the
// import. A disabled import plugin leaves no source, so the dialog says where to enable it.
export function OmpImportDialog({ open, labels, locale, initialSourceId, onClose, onImported, onOpenPlugins }: Props) {
  const [scope, setScope] = useState<Scope>("workspace");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const omp = useOmpImport({ open, all: scope === "all", query, initialSourceId });
  const alreadyImported = Boolean(omp.preview?.source.imported);
  const multipleSources = omp.sources.length > 1;
  const noSources = omp.sourcesState === "ready" && omp.sources.length === 0;
  const sourcesFailed = omp.sourcesState === "error";
  const title = multipleSources ? labels.importTitle : labels.ompImportTitle;
  const lede = multipleSources ? labels.importLede : labels.ompImportLede;

  async function submit() {
    const sessionId = await omp.runImport();
    if (sessionId) onImported(sessionId);
  }

  return (
    <Modal label={title} onClose={onClose} className="omp-import-sheet" hidden={!open}>
      <header className="omp-import-head">
        <div className="omp-import-titles">
          <h2 className="dialog-title">{title}</h2>
          <p className="dialog-lede">{lede}</p>
        </div>
        <IconButton icon={<Icon name="close" size={14} />} label={labels.close} size="sm" onClick={onClose} />
      </header>

      {(noSources || sourcesFailed) ? (
        <div className="omp-import-body is-empty">
          {noSources ? (
            <EmptyState
              icon={<Icon name="plugin" size={18} />}
              title={labels.importSourcesEmpty}
              body={labels.importSourcesEmptyHint}
              action={onOpenPlugins && (
                <Button variant="secondary" size="sm" onClick={onOpenPlugins}>{labels.importOpenPlugins}</Button>
              )}
            />
          ) : (
            <EmptyState
              icon={<Icon name="failed" size={18} />}
              title={labels.importSourcesError}
              body={omp.sourcesError}
            />
          )}
        </div>
      ) : (
        <>
          <div className="omp-import-controls">
            {multipleSources && (
              <DesktopSelect
                ariaLabel={labels.importSource}
                value={omp.sourceId}
                placeholder={labels.importSource}
                options={omp.sourceOptions}
                onChange={omp.setSourceId}
                popoverPlacement="bottom"
                className="omp-import-source"
              />
            )}
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
        </>
      )}
      {(noSources || sourcesFailed) && (
        <footer className="dialog-actions omp-import-actions">
          <div className="omp-import-buttons">
            <Button variant="secondary" onClick={onClose}>{labels.cancel}</Button>
          </div>
        </footer>
      )}
    </Modal>
  );
}
