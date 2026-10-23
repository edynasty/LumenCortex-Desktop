import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import { IMPORT_LIST_LIMIT } from "../../lib/omp-import";
import type { ImportPreview, ImportSessionSummary, ImportSource } from "../../types";

// The import dialog's data: the running import sources, the bounded list of the chosen source, the
// selected session's preview and the one import. Core answers every call; nothing here is cached
// across openings, because another process may have imported a session or written a new one in the
// meantime.
export type OmpLoadState = "idle" | "loading" | "ready" | "error";

type Options = {
  open: boolean;
  all: boolean;
  query: string;
  /** The source the opening entry named; absent opens on Core's first source. */
  initialSourceId?: string;
};

export function useOmpImport({ open, all, query, initialSourceId = "" }: Options) {
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [sourcesState, setSourcesState] = useState<OmpLoadState>("idle");
  const [sourcesError, setSourcesError] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sessions, setSessions] = useState<ImportSessionSummary[]>([]);
  const [listStatus, setListStatus] = useState<OmpLoadState>("idle");
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewState, setPreviewState] = useState<OmpLoadState>("idle");
  const [previewError, setPreviewError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  // Only the newest read is applied: typing in the search must not let an older answer replace a
  // newer list, and a slow preview must not land on another selection.
  const sourcesRequest = useRef(0);
  const listRequest = useRef(0);
  const previewRequest = useRef(0);

  // Every opening starts clean; the sources and the list are read again below. An entry that named
  // its source keeps it, so a second import plugin's button never opens on the first plugin's list.
  useEffect(() => {
    if (!open) return;
    setSourceId(initialSourceId);
    setSessions([]);
    setListStatus("idle");
    setListError("");
    setSelected("");
    setPreview(null);
    setPreviewState("idle");
    setPreviewError("");
    setImporting(false);
    setImportError("");
  }, [open]);

  // The sources come from Core's plugin catalog: a disabled or failed import plugin has none, and
  // the dialog then shows why instead of an empty list.
  useEffect(() => {
    if (!open) return;
    const request = ++sourcesRequest.current;
    setSourcesState("loading");
    setSourcesError("");
    bridge.importSources().then(
      (rows) => {
        if (request !== sourcesRequest.current) return;
        setSources(rows);
        setSourcesState("ready");
        setSourceId((current) => (current && rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? "")));
      },
      (err) => {
        if (request !== sourcesRequest.current) return;
        setSources([]);
        setSourcesState("error");
        setSourcesError(String(err));
      },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // An entry names its source before Core's list arrives: wait until Core confirms the source runs.
    if (!sourceId || sourcesState !== "ready") {
      setSessions([]);
      setListStatus("idle");
      setListError("");
      setSelected("");
      return;
    }
    const request = ++listRequest.current;
    setListStatus("loading");
    setListError("");
    bridge.importSessions(sourceId, { all, query, limit: IMPORT_LIST_LIMIT }).then(
      (rows) => {
        if (request !== listRequest.current) return;
        setSessions(rows);
        setListStatus("ready");
        // A selection filtered out of the new list has no preview to keep showing.
        setSelected((current) => (current && rows.some((row) => row.path === current) ? current : ""));
      },
      (err) => {
        if (request !== listRequest.current) return;
        setSessions([]);
        setListStatus("error");
        setListError(String(err));
      },
    );
  }, [open, sourceId, sourcesState, all, query]);

  useEffect(() => {
    if (!open) return;
    if (!sourceId || !selected) {
      setPreview(null);
      setPreviewState("idle");
      setPreviewError("");
      return;
    }
    const request = ++previewRequest.current;
    setPreviewState("loading");
    setPreviewError("");
    setImportError("");
    bridge.previewImport(sourceId, selected).then(
      (value) => {
        if (request !== previewRequest.current) return;
        setPreview(value);
        setPreviewState("ready");
      },
      (err) => {
        if (request !== previewRequest.current) return;
        setPreview(null);
        setPreviewState("error");
        setPreviewError(String(err));
      },
    );
  }, [open, sourceId, selected]);

  const select = useCallback((path: string) => setSelected(path), []);

  // Import returns the native session to open: the imported root, or the one an earlier import
  // wrote. An already imported session is not written again, so its button opens it directly.
  const runImport = useCallback(async (): Promise<string | null> => {
    if (!sourceId || !selected || !preview || importing) return null;
    const existing = preview.source.imported?.sessionId;
    if (existing) return existing;
    setImporting(true);
    setImportError("");
    try {
      const result = await bridge.importSession(sourceId, selected);
      return result.sessionId;
    } catch (err) {
      setImportError(String(err));
      return null;
    } finally {
      setImporting(false);
    }
  }, [sourceId, selected, preview, importing]);

  // The selector's options: one source is not a choice, so the dialog only offers one when Core
  // runs more than one import plugin.
  const sourceOptions = useMemo(
    () => sources.map((source) => ({ value: source.id, label: source.name })),
    [sources],
  );

  // Until a source is confirmed the list has nothing to show: while the sources are still being
  // read it is loading, not empty, so the dialog never claims "no session found" before it asked.
  const listState: OmpLoadState =
    sourcesState === "loading" ? "loading"
      : sourcesState === "ready" && sourceId ? listStatus
        : "idle";

  return {
    sources,
    sourcesState,
    sourcesError,
    sourceOptions,
    sourceId,
    setSourceId,
    sessions,
    listState,
    listError,
    selected,
    preview,
    previewState,
    previewError,
    importing,
    importError,
    select,
    runImport,
  };
}
