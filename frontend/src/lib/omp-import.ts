import type { AppCopy } from "./i18n/app-copy";
import type { ImportPreview, ImportSessionSummary, ImportWarning } from "../types";

// The import dialog's list bound. Core defaults to 100 and caps at 500; the dialog asks for the
// default and tells the user to narrow a full list with the search.
export const IMPORT_LIST_LIMIT = 100;

// A source session may have no title slot; its id is then the only stable name.
export function ompSessionTitle(session: ImportSessionSummary): string {
  return session.title?.trim() || session.id;
}

// A preview warning carries a stable code and Core's English explanation. A code this build knows
// gets the localized copy; an unknown one falls back to that English message, never to nothing.
export function ompWarningText(labels: AppCopy, warning: ImportWarning): string {
  switch (warning.code) {
    case "workspace_mismatch":
      return labels.ompWarnWorkspaceMismatch;
    case "maybe_running":
      return labels.ompWarnMaybeRunning;
    case "open_tool_calls":
      return labels.ompWarnOpenToolCalls;
    case "children_capped":
      return labels.ompWarnChildrenCapped;
    case "malformed_records":
      return labels.ompWarnMalformedRecords;
    case "source_changed":
      return labels.ompWarnSourceChanged;
    default:
      return warning.message;
  }
}

// Binary-free size for a list row: bytes below 1 KiB, then one decimal.
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export type ImportStatRow = { key: string; label: string; value: number };

// The counts the preview shows. The omissions are shown even at zero: "0 thinking blocks left out"
// is the statement that nothing hidden was dropped, not an absent row. Rare findings (off-branch
// records, malformed records, subagents beyond the bound) appear only when they happened.
export function ompStatRows(preview: ImportPreview, labels: AppCopy): ImportStatRow[] {
  const stats = preview.stats;
  const rows: ImportStatRow[] = [
    { key: "messages", label: labels.ompImportMessages, value: stats.userMessages + stats.assistantMessages },
    { key: "toolCalls", label: labels.ompImportToolCalls, value: stats.toolCalls },
    { key: "subagents", label: labels.ompImportSubagentCount, value: preview.children?.length ?? 0 },
    { key: "compactions", label: labels.ompImportCompactions, value: stats.compactions },
    { key: "images", label: labels.ompImportImages, value: stats.images },
    { key: "thinking", label: labels.ompImportThinking, value: stats.thinkingBlocks },
    { key: "hidden", label: labels.ompImportHidden, value: stats.hiddenMessages },
    { key: "interrupted", label: labels.ompImportInterrupted, value: stats.interruptedCalls },
  ];
  if (preview.offBranch > 0) rows.push({ key: "offBranch", label: labels.ompImportOffBranch, value: preview.offBranch });
  if (preview.malformed > 0) rows.push({ key: "malformed", label: labels.ompImportMalformed, value: preview.malformed });
  if ((preview.childrenSkipped ?? 0) > 0) {
    rows.push({ key: "childrenSkipped", label: labels.ompImportChildrenSkipped, value: preview.childrenSkipped ?? 0 });
  }
  return rows;
}
