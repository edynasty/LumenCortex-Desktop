import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, CircleX, FlaskConical } from "lucide-react";
import { bridge } from "../../lib/bridge";
import type { ChecksInfo } from "../../types";

type Props = {
  sessionId: string;
  // The review's reload counter and the run state: Core's view is re-read when either changes (the
  // completion gate runs checks at the end of a run).
  revision: number;
  running: boolean;
  labels: {
    checks: string;
    checksSatisfied: string;
    checksStatusFailed: string;
    checksStatusError: string;
    checksNeverRun: string;
    checksStale: string;
  };
};

// CheckSummary shows Core's verdict for each configured check at the reviewed state (design §4.7): a
// check passes only through a runtime or human result at the current fingerprint, never because a
// command the agent ran exited 0. The Checks tab of the inspector has the history and artifacts.
export function CheckSummary({ sessionId, revision, running, labels }: Props) {
  const [info, setInfo] = useState<ChecksInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    bridge
      .sessionChecks(sessionId)
      .then((next) => !cancelled && setInfo(next))
      .catch(() => !cancelled && setInfo(null));
    return () => {
      cancelled = true;
    };
  }, [sessionId, revision, running]);

  const checks = info?.checks ?? [];
  if (!checks.length) return null;

  return (
    <section className="review-checks" aria-label={labels.checks}>
      <div className="review-checks-title">
        <FlaskConical size={13} strokeWidth={1.7} aria-hidden />
        <strong>{labels.checks}</strong>
      </div>
      <div className="review-check-list">
        {checks.map(({ spec, satisfied, newest }) => {
          const failed = !satisfied && newest && newest.status !== "passed";
          let state = labels.checksNeverRun;
          if (satisfied) state = labels.checksSatisfied;
          else if (failed) state = newest.status === "error" ? labels.checksStatusError : labels.checksStatusFailed;
          else if (newest) state = labels.checksStale;
          return (
            <div className={`review-check ${satisfied ? "passed" : failed ? "failed" : "pending"}`} key={spec.id}>
              {satisfied ? (
                <CheckCircle2 size={13} strokeWidth={1.8} aria-hidden />
              ) : failed ? (
                <CircleX size={13} strokeWidth={1.8} aria-hidden />
              ) : (
                <CircleDashed size={13} strokeWidth={1.8} aria-hidden />
              )}
              <code>{spec.id}</code>
              <span>{state}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
