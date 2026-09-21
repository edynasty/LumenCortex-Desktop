import { CheckCircle2, CircleX, FlaskConical } from "lucide-react";
import type { CheckResult } from "./checks";

type Props = {
  results: CheckResult[];
  labels: {
    checks: string;
    passed: string;
    failed: string;
    truncated: string;
  };
};

export function CheckSummary({ results, labels }: Props) {
  if (!results.length) return null;

  return (
    <section className="review-checks" aria-label={labels.checks}>
      <div className="review-checks-title">
        <FlaskConical size={13} strokeWidth={1.7} aria-hidden />
        <strong>{labels.checks}</strong>
      </div>
      <div className="review-check-list">
        {results.map((result) => (
          <div className={`review-check ${result.ok ? "passed" : "failed"}`} key={result.seq}>
            {result.ok
              ? <CheckCircle2 size={13} strokeWidth={1.8} aria-hidden />
              : <CircleX size={13} strokeWidth={1.8} aria-hidden />}
            <code>{result.command}</code>
            <span>{result.ok ? labels.passed : labels.failed}</span>
            {result.truncated && <small>{labels.truncated}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}
