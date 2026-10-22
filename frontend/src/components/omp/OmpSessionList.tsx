import { useEffect, useState } from "react";
import type { OmpLoadState } from "../../app/hooks/useOmpImport";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { formatByteSize, IMPORT_LIST_LIMIT, ompSessionTitle } from "../../lib/omp-import";
import { formatRelative } from "../../lib/relative-time";
import type { ImportSessionSummary } from "../../types";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
import { LoadingState } from "../primitives/LoadingState";

type Props = {
  sessions: ImportSessionSummary[];
  state: OmpLoadState;
  error: string;
  selected: string;
  labels: AppCopy;
  locale: Locale;
  onSelect: (path: string) => void;
};

function useNow(interval: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

function SessionRow({ session, selected, now, labels, locale, onSelect }: {
  session: ImportSessionSummary;
  selected: boolean;
  now: number;
  labels: AppCopy;
  locale: Locale;
  onSelect: () => void;
}) {
  const imported = session.imported;
  return (
    <button
      type="button"
      className={`omp-row ${selected ? "is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="omp-row-main">
        <span className="omp-row-title">
          <strong>{ompSessionTitle(session)}</strong>
          {imported && <span className="omp-badge">{labels.ompImportImported}</span>}
          {imported?.sourceChanged && <span className="omp-badge is-warn">{labels.ompImportSourceChanged}</span>}
        </span>
        <span className="omp-row-path path" title={session.cwd}>{session.cwd}</span>
      </span>
      <span className="omp-row-meta">
        <span>{formatRelative(session.updatedAt, now, locale)}</span>
        <span>{formatByteSize(session.size)}</span>
        {session.children > 0 && <span>{labels.ompImportSubagents(session.children)}</span>}
      </span>
    </button>
  );
}

// The bounded session list. Core answers the search and the workspace filter; this only renders
// what it returned, and says so when the list stopped at the bound.
export function OmpSessionList({ sessions, state, error, selected, labels, locale, onSelect }: Props) {
  const now = useNow(30_000);

  if (state === "error") {
    return (
      <div className="omp-list-state">
        <EmptyState icon={<Icon name="failed" size={18} />} title={labels.ompImportListError} body={error} compact />
      </div>
    );
  }
  if (state === "loading" && sessions.length === 0) {
    return <div className="omp-list-state"><LoadingState label={labels.ompImportLoading} compact /></div>;
  }
  if (sessions.length === 0) {
    return (
      <div className="omp-list-state">
        <EmptyState icon={<Icon name="history" size={18} />} title={labels.ompImportEmpty} compact />
      </div>
    );
  }

  return (
    <nav className="omp-list" aria-label={labels.ompImportTitle}>
      {sessions.map((session) => (
        <SessionRow
          key={session.path}
          session={session}
          selected={session.path === selected}
          now={now}
          labels={labels}
          locale={locale}
          onSelect={() => onSelect(session.path)}
        />
      ))}
      {sessions.length >= IMPORT_LIST_LIMIT && (
        <p className="omp-list-note">{labels.ompImportLimit.replace("{limit}", String(IMPORT_LIST_LIMIT))}</p>
      )}
    </nav>
  );
}
