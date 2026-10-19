import { useState } from "react";
import { copyText } from "../../lib/clipboard";
import { sessionCause } from "../../lib/session-status";
import type { Session } from "../../types";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { Markdown } from "./Markdown";

type Labels = {
  failureTitle: string;
  retry: string;
  finalAnswer: string;
  copy: string;
  copied: string;
};

/**
 * How the run ended, at the foot of the transcript: a failure block with Core's cause and Retry,
 * a Retry action after an interruption, and the final answer (settled once the Task State
 * resolution is done).
 */
export function ThreadOutcome({ session, running, busy, settled, failureHeadline, labels, onRetry }: {
  session: Session;
  running: boolean;
  busy: boolean;
  settled: boolean;
  failureHeadline: string;
  labels: Labels;
  onRetry: () => void;
}) {
  const [finalCopied, setFinalCopied] = useState(false);
  const cause = sessionCause(session);
  const failed = !running && session.status === "failed";
  const interrupted = !running && session.status === "interrupted";

  return (
    <>
      {failed && (
        <section className="block failure-block" aria-live="polite">
          <header className="block-head">
            <Icon name="failed" size={16} className="block-icon" />
            <span className="block-kicker">{labels.failureTitle}</span>
            <h3>{failureHeadline}</h3>
          </header>
          {cause?.message && <pre className="block-code">{cause.message}</pre>}
          <footer className="block-actions">
            <Button variant="primary" icon={<Icon name="retry" size={13} />} disabled={busy} onClick={onRetry}>
              {labels.retry}
            </Button>
          </footer>
        </section>
      )}

      {interrupted && (
        <div className="ledger-action">
          <Button variant="secondary" icon={<Icon name="retry" size={13} />} disabled={busy} onClick={onRetry}>
            {labels.retry}
          </Button>
        </div>
      )}

      {session.final && (
        <section className={`block result-block${settled ? " is-settled" : ""}`}>
          <header className="block-head">
            <Icon name="done" size={16} className="block-icon" />
            <h3>{labels.finalAnswer}</h3>
            <span className="toolbar-spacer" />
            <button
              type="button"
              className="thread-inline-action"
              onClick={async () => {
                if (await copyText(session.final || "")) {
                  setFinalCopied(true);
                  window.setTimeout(() => setFinalCopied(false), 1200);
                }
              }}
            >
              <Icon name={finalCopied ? "checkmark" : "copy"} size={12} />
              {finalCopied ? labels.copied : labels.copy}
            </button>
          </header>
          <div className="block-body">
            <Markdown text={session.final} />
          </div>
        </section>
      )}
    </>
  );
}
