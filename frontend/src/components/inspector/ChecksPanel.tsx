import { presentError } from "../../lib/error-presentation";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { CheckArtifact, CheckInfo, CheckResult, RuntimeEvent } from "../../types";
import { ConfigWarnings } from "../config/ConfigWarnings";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import { InspectorSection } from "./Section";
import { useChecks } from "./useChecks";

type Props = {
  sessionId: string;
  events: RuntimeEvent[];
  configKey: string;
  trusting: boolean;
  labels: AppCopy;
  onTrust: () => void;
};

function statusLabel(labels: AppCopy, status: string): string {
  if (status === "passed") return labels.checksStatusPassed;
  if (status === "failed") return labels.checksStatusFailed;
  if (status === "error") return labels.checksStatusError;
  return status;
}

function provenanceLabel(labels: AppCopy, provenance: string): string {
  if (provenance === "runtime") return labels.checksByRuntime;
  if (provenance.startsWith("human:")) return labels.checksByHuman.replace("{actor}", provenance.slice("human:".length));
  return provenance;
}

function when(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : date.toLocaleString();
}

function ArtifactButtons({ result, labels, open, onToggle }: { result: CheckResult; labels: AppCopy; open?: string; onToggle: (hash: string) => void }) {
  const hashes = result.artifacts ?? [];
  if (!hashes.length) return null;
  // Core stores a result's log first and, for a result that did not pass, the diff second
  // (internal/evaluator run). The viewer shows the artifact's own kind once opened.
  return (
    <div className="check-artifacts">
      {hashes.map((hash, index) => (
        <button key={hash} type="button" aria-pressed={open === hash} className="btn btn-sm btn-ghost" onClick={() => onToggle(hash)}>
          {index === 0 ? labels.checksArtifactLog : labels.checksArtifactDiff}
        </button>
      ))}
    </div>
  );
}

function CheckCard({
  check,
  labels,
  canAccept,
  accepting,
  openArtifact,
  onAccept,
  onToggleArtifact,
}: {
  check: CheckInfo;
  labels: AppCopy;
  canAccept: boolean;
  accepting: boolean;
  openArtifact?: string;
  onAccept: () => void;
  onToggleArtifact: (hash: string) => void;
}) {
  const { spec, satisfied, deciding, newest } = check;
  let detail: string = labels.checksNeverRun;
  if (satisfied && deciding) detail = `${labels.checksSatisfied} · ${provenanceLabel(labels, deciding.provenance)}`;
  else if (newest?.status === "passed") detail = labels.checksStale;
  else if (newest) detail = `${statusLabel(labels, newest.status)} · ${when(newest.at)}`;
  const tone = satisfied ? "passed" : newest && newest.status !== "passed" ? newest.status : "pending";
  return (
    <li className={`check-card ${tone}`}>
      <div className="check-card-head">
        <span className="check-dot" aria-hidden />
        <strong>{spec.id}</strong>
        <span className="chip is-static">{spec.kind}</span>
        <span className="chip is-static">{spec.required ? labels.checksRequired : labels.checksOptional}</span>
        <span className="check-source">{spec.source === "workspace" ? labels.checksSourceWorkspace : labels.checksSourceGlobal}</span>
      </div>
      {spec.command && <code className="check-command mono" title={spec.command}>{spec.command}</code>}
      <p className="check-detail">
        {detail}
      </p>
      <div className="check-actions">
        {!satisfied && newest && <ArtifactButtons result={newest} labels={labels} open={openArtifact} onToggle={onToggleArtifact} />}
        {!satisfied && (
          <button type="button" className="btn btn-sm btn-secondary check-accept" disabled={!canAccept || accepting} onClick={onAccept}>
            {accepting ? labels.checksAccepting : labels.checksAccept}
          </button>
        )}
      </div>
    </li>
  );
}

function ArtifactViewer({ artifact, labels, onClose }: { artifact: CheckArtifact; labels: AppCopy; onClose: () => void }) {
  return (
    <section className="check-artifact" aria-label={artifact.kind === "diff" ? labels.checksArtifactDiff : labels.checksArtifactLog}>
      <header>
        <span>{artifact.kind === "diff" ? labels.checksArtifactDiff : labels.checksArtifactLog}</span>
        <code className="mono">{artifact.hash.slice(0, 19)}</code>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>{labels.checksArtifactClose}</button>
      </header>
      {artifact.truncated && <p className="tp-pane-muted">{labels.checksArtifactTruncated}</p>}
      <pre>{artifact.text}</pre>
    </section>
  );
}

// ChecksPanel shows the session's configured checks against the workspace's current state, the result
// history with its logs and diffs, and lets the user accept a check for the current state (design §7,
// M4.2). Core decides everything: satisfaction, reuse and the completion gate.
export function ChecksPanel({ sessionId, events, configKey, trusting, labels, onTrust }: Props) {
  const { info, results, hasMore, artifact, error, accepting, refresh, loadMore, accept, toggleArtifact, closeArtifact } = useChecks({
    sessionId,
    events,
    configKey,
  });

  if (!sessionId) return <EmptyState compact icon={<Icon name="checkRun" size={18} />} title={labels.checksNoSession} />;

  const checks = info?.checks ?? [];
  const head = info?.env.head ?? "";
  const canAccept = head !== "";

  return (
    <>
      <InspectorSection
        title={labels.checks}
        action={
          <IconButton
            label={labels.checksRefresh}
            size="sm"
            icon={<Icon name="refresh" size={13} />}
            onClick={() => void refresh()}
          />
        }
      >
        {info && (
          <p className="tp-pane-muted">
            {head
              ? `${labels.checksEnvHead.replace("{head}", head.slice(0, 7))} · ${info.env.dirtyHash ? labels.checksEnvDirty : labels.checksEnvClean}`
              : labels.checksEnvNoGit}
          </p>
        )}

        {(info?.warnings?.length ?? 0) > 0 && (
          <ConfigWarnings labels={labels} warnings={info?.warnings ?? []} trusting={trusting} onTrust={onTrust} />
        )}

        {info && checks.length === 0 ? (
          <p className="tp-pane-muted">{labels.checksEmpty}</p>
        ) : (
          <ul className="check-list">
            {checks.map((check) => (
              <CheckCard
                key={check.spec.id}
                check={check}
                labels={labels}
                canAccept={canAccept}
                accepting={accepting === check.spec.id}
                openArtifact={artifact?.hash}
                onAccept={() => void accept(check.spec.id)}
                onToggleArtifact={(hash) => void toggleArtifact(hash)}
              />
            ))}
          </ul>
        )}
        {checks.some((check) => !check.satisfied) && canAccept && <p className="tp-pane-muted">{labels.checksAcceptHint}</p>}
      </InspectorSection>

      {artifact && <ArtifactViewer artifact={artifact} labels={labels} onClose={closeArtifact} />}

      <InspectorSection title={labels.checksHistory}>
        {results.length === 0 ? (
          <p className="tp-pane-muted">{labels.checksHistoryEmpty}</p>
        ) : (
          <ol className="check-history">
            {results.map((result) => (
              <li key={result.seq} className={`check-row ${result.status}`}>
                <div>
                  <span className="check-dot" aria-hidden />
                  <strong>{result.check}</strong>
                  <span className="check-status">{statusLabel(labels, result.status)}</span>
                  <span className="check-source">{provenanceLabel(labels, result.provenance)}</span>
                </div>
                <div className="check-row-meta">
                  <time dateTime={result.at}>{when(result.at)}</time>
                  <ArtifactButtons result={result} labels={labels} open={artifact?.hash} onToggle={(hash) => void toggleArtifact(hash)} />
                </div>
              </li>
            ))}
          </ol>
        )}
        {hasMore && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void loadMore()}>
            {labels.checksLoadMore}
          </button>
        )}
      </InspectorSection>

      {error && (
        <p className="tp-pane-error" role="alert">
          {presentError(labels, error)}
        </p>
      )}
    </>
  );
}
