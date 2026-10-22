import { useCallback, useEffect, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import { OMP_IMPORT_LIST_LIMIT } from "../../lib/omp-import";
import type { OMPImportPreview, OMPSessionSummary } from "../../types";

// The import dialog's data: the bounded list, the selected session's preview and the one import.
// Core answers every call; nothing here is cached across openings, because another process may
// have imported a session or written a new one in the meantime.
export type OmpLoadState = "idle" | "loading" | "ready" | "error";

type Options = {
  open: boolean;
  all: boolean;
  query: string;
};

export function useOmpImport({ open, all, query }: Options) {
  const [sessions, setSessions] = useState<OMPSessionSummary[]>([]);
  const [listState, setListState] = useState<OmpLoadState>("idle");
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState("");
  const [preview, setPreview] = useState<OMPImportPreview | null>(null);
  const [previewState, setPreviewState] = useState<OmpLoadState>("idle");
  const [previewError, setPreviewError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  // Only the newest read is applied: typing in the search must not let an older answer replace a
  // newer list, and a slow preview must not land on another selection.
  const listRequest = useRef(0);
  const previewRequest = useRef(0);

  // Every opening starts clean; the list and the preview are read again below.
  useEffect(() => {
    if (!open) return;
    setSelected("");
    setPreview(null);
    setPreviewState("idle");
    setPreviewError("");
    setImporting(false);
    setImportError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const request = ++listRequest.current;
    setListState("loading");
    setListError("");
    bridge.ompSessions({ all, query, limit: OMP_IMPORT_LIST_LIMIT }).then(
      (rows) => {
        if (request !== listRequest.current) return;
        setSessions(rows);
        setListState("ready");
        // A selection filtered out of the new list has no preview to keep showing.
        setSelected((current) => (current && rows.some((row) => row.path === current) ? current : ""));
      },
      (err) => {
        if (request !== listRequest.current) return;
        setSessions([]);
        setListState("error");
        setListError(String(err));
      },
    );
  }, [open, all, query]);

  useEffect(() => {
    if (!open) return;
    if (!selected) {
      setPreview(null);
      setPreviewState("idle");
      setPreviewError("");
      return;
    }
    const request = ++previewRequest.current;
    setPreviewState("loading");
    setPreviewError("");
    setImportError("");
    bridge.previewOMPSession(selected).then(
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
  }, [open, selected]);

  const select = useCallback((path: string) => setSelected(path), []);

  // Import returns the native session to open: the imported root, or the one an earlier import
  // wrote. An already imported session is not written again, so its button opens it directly.
  const runImport = useCallback(async (): Promise<string | null> => {
    if (!selected || !preview || importing) return null;
    const existing = preview.source.imported?.sessionId;
    if (existing) return existing;
    setImporting(true);
    setImportError("");
    try {
      const result = await bridge.importOMPSession(selected);
      return result.sessionId;
    } catch (err) {
      setImportError(String(err));
      return null;
    } finally {
      setImporting(false);
    }
  }, [selected, preview, importing]);

  return {
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
