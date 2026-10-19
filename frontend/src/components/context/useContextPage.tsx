/*
 * The Context page's controller (contract for the integrator): returns the sidebar nav and
 * the main view for route.kind === "context". One derivation (context-graph.ts) feeds the
 * list, the graph, the counts and the detail. All data is real Core data the Desktop
 * already holds: sessions from the workspace, each bound thread's Task State via
 * bridge.taskState. Loading is bounded (the CONTEXT_THREAD_BOUND most recent non-archived
 * threads), lazy (only while the route is active) and cancelled on page exit.
 *
 * Demo relations supported here: thread→file via Task State path references (included /
 * suggested; excluded never draws), thread→thread via "thread" references and Core's
 * subagent parent/child link. The Demo's note nodes, citations, typed note links and blob
 * freshness have no Core source today; until Core records notes, they are not drawn.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, TaskStateInfo } from "../../types";
import { formatRelative } from "../../lib/relative-time";
import { sessionUI } from "../../lib/session-ui";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { bridge } from "../../lib/bridge";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { ContextGraphView } from "./ContextGraphView";
import { FileDetail, ThreadDetail } from "./ContextDetail";
import { PathLabel } from "../primitives/PathLabel";
import {
  CONTEXT_THREAD_BOUND,
  boundThreads,
  contextGraph,
  fileOf,
  type ContextFilter,
  type ContextLens,
} from "./context-page-types";
import "./context.css";

const FILTERS: ContextFilter[] = ["all", "threads", "files"];
const FILTER_LABELS: Record<ContextFilter, "contextFilterAll" | "contextFilterThreads" | "contextFilterFiles"> = {
  all: "contextFilterAll",
  threads: "contextFilterThreads",
  files: "contextFilterFiles",
};
const FILTER_ICONS: Record<ContextFilter, "context" | "discussion" | "file"> = { all: "context", threads: "discussion", files: "file" };

export function useContextPage(input: {
  enabled: boolean;
  workspace: string;
  sessions: Session[];
  labels: AppCopy;
  locale: Locale;
  onOpenThread: (sessionId: string) => void;
  onError: (message: string) => void;
}): { sidebar: ReactNode; content: ReactNode } {
  const { enabled, sessions, labels, locale, onOpenThread, onError } = input;
  const [filter, setFilter] = useState<ContextFilter>("all");
  const [lens, setLens] = useState<ContextLens>("list");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, TaskStateInfo>>({});
  const [pending, setPending] = useState(0);
  const statesRef = useRef(states);

  const threads = useMemo(() => boundThreads(sessions), [sessions]);
  // Refetch only when the bound itself moves (a thread updates, appears or scrolls out).
  const revision = useMemo(() => threads.map((s) => `${s.id}:${s.updatedAt}`).join("|"), [threads]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const ids = threads.map((session) => session.id);
    setPending(ids.length);
    Promise.all(
      ids.map((id) =>
        bridge.taskState(id).then(
          (info): [string, TaskStateInfo] | null => [id, info],
          (): [string, TaskStateInfo] | null => null,
        ),
      ),
    ).then((rows) => {
      if (cancelled) return;
      const next = { ...statesRef.current };
      let failed = 0;
      for (const row of rows) {
        if (row) next[row[0]] = row[1];
        else failed += 1;
      }
      statesRef.current = next;
      setStates(next);
      setPending(0);
      if (failed > 0) onError(labels.contextStateError);
    });
    return () => {
      cancelled = true;
      setPending(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels/onError are stable app callbacks; refetch follows the bound revision only
  }, [enabled, revision]);

  const stateMap = useMemo(() => new Map(Object.entries(states)), [states]);
  const graph = useMemo(() => contextGraph(threads, stateMap), [threads, stateMap]);

  const threadNodes = useMemo(() => graph.nodes.filter((node) => node.kind === "thread"), [graph]);
  const fileNodes = useMemo(() => graph.nodes.filter((node) => node.kind === "file"), [graph]);
  const counts: Record<ContextFilter, number> = {
    all: graph.nodes.length,
    threads: threadNodes.length,
    files: fileNodes.length,
  };

  const select = (id: string | null) => setSelected(id);

  /* —— Sidebar: filters over the same derivation as the page. —— */
  const sidebar = (
    <nav className="sidebar-scroll" aria-label={labels.contextPage}>
      {FILTERS.map((key) => (
        <button
          key={key}
          type="button"
          className="list-row"
          aria-current={filter === key ? "page" : undefined}
          onClick={() => setFilter(key)}
        >
          <Icon name={FILTER_ICONS[key]} size={15} />
          <span className="list-row-main">{labels[FILTER_LABELS[key]]}</span>
          <span className="list-row-meta">{counts[key]}</span>
        </button>
      ))}
    </nav>
  );

  /* —— Content —— */
  const now = Date.now();
  const byId = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);
  const q = query.trim().toLowerCase();

  const threadRows = threadNodes.filter(
    (node) => !q || node.title.toLowerCase().includes(q) || node.sessionId.toLowerCase().includes(q),
  );
  const fileRows = fileNodes.filter((node) => !q || node.path.toLowerCase().includes(q));
  const showFiles = filter === "files";

  const selectedFile = fileOf(selected);
  const selectedThread = selected && !selectedFile ? byId.get(selected) : undefined;
  const detail = selectedThread ? (
    <ThreadDetail
      session={selectedThread}
      state={states[selectedThread.id]}
      threadTitle={(sessionId) => {
        const session = byId.get(sessionId);
        return session ? sessionUI(session).title : undefined;
      }}
      labels={labels}
      locale={locale}
      now={now}
      onOpenThread={onOpenThread}
      onSelectItem={select}
    />
  ) : selectedFile ? (
    <FileDetail
      path={selectedFile}
      graph={graph}
      labels={labels}
      sessions={sessions}
      onSelectItem={select}
    />
  ) : null;

  if (threads.length === 0) {
    return {
      sidebar,
      content: (
        <div className="context-page">
          <div className="context-empty">
            <Icon name="context" size={30} />
            <h2>{labels.contextEmptyTitle}</h2>
            <p>{labels.contextEmptyBody}</p>
          </div>
        </div>
      ),
    };
  }

  const header = (
    <header className="context-head">
      <div className="context-head-row">
        <p className="context-lede">{labels.contextLede}</p>
        <SegmentedControl
          ariaLabel={labels.contextLensLabel}
          value={lens}
          onChange={setLens}
          options={[
            { value: "list", label: <><Icon name="list" size={13} />{labels.contextLensList}</> },
            { value: "graph", label: <><Icon name="graph" size={13} />{labels.contextLensGraph}</> },
          ]}
        />
      </div>
      <p className="context-bound">{labels.contextBoundNote(CONTEXT_THREAD_BOUND)}</p>
      <label className="context-search">
        <Icon name="search" size={13} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.contextSearchLabel}
          aria-label={labels.contextSearchLabel}
        />
      </label>
      {pending > 0 && <p className="context-loading">{labels.contextLoadingState(pending)}</p>}
    </header>
  );

  const list = (
    <div className="context-list" role="list" aria-label={labels.contextPage}>
      {!showFiles && threadRows.map((node) => {
        const session = byId.get(node.sessionId)!;
        const refs = (states[node.sessionId]?.state.references ?? []).length;
        return (
          <button
            key={node.id}
            type="button"
            role="listitem"
            className={`context-row ${selected === node.id ? "is-selected" : ""}`}
            aria-current={selected === node.id ? "true" : undefined}
            onClick={() => select(node.id)}
          >
            <Icon name={node.finished ? "done" : node.pinned ? "pin" : "discussion"} size={15} />
            <span className="context-row-body">
              <span className="context-row-title">{node.title}</span>
              <span className="context-row-meta">
                <span className="context-row-kind">
                  {node.finished ? labels.taskResolutionDone : labels.taskResolutionOpen}
                  {" · "}
                  {labels.contextReferenceCount(refs)}
                </span>
              </span>
            </span>
            <span className="context-row-time">{formatRelative(session.updatedAt, now, locale)}</span>
          </button>
        );
      })}
      {showFiles && fileRows.map((node) => (
        <button
          key={node.id}
          type="button"
          role="listitem"
          className={`context-row ${selected === node.id ? "is-selected" : ""}`}
          aria-current={selected === node.id ? "true" : undefined}
          onClick={() => select(node.id)}
        >
          <Icon name={node.suggestedOnly ? "stale" : "file"} size={15} />
          <span className="context-row-body">
            <PathLabel path={node.path} />
            <span className="context-row-meta">
              <span className="context-row-kind">
                {node.suggestedOnly ? labels.contextSuggested : labels.contextIncluded}
                {" · "}
                {labels.contextCiteCount(graph.edges.filter((edge) => edge.to === node.id).length)}
              </span>
            </span>
          </span>
        </button>
      ))}
      {(showFiles ? fileRows : threadRows).length === 0 && (
        <p className="context-none">{labels.contextNoResults}</p>
      )}
    </div>
  );

  const content = (
    <div className="context-page">
      <div className={`context-view lens-${lens}`}>
        <div className="context-main">
          {header}
          {lens === "graph" ? (
            <div className="context-graph-scroll">
              <ContextGraphView graph={graph} labels={labels} selected={selected} onSelect={select} />
            </div>
          ) : (
            list
          )}
        </div>
        <div className="context-detail">
          {detail ?? (
            <div className="context-placeholder">
              <Icon name="context" size={22} />
              <p>{labels.contextSelectHint}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return { sidebar, content };
}
