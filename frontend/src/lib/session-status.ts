import type { Session } from "../types";

// ErrRunHeld text from core's runtime package; Wails delivers Go errors as strings.
const runHeldMessage = "run is active in another process or engine";

export type SessionCause = { kind?: string; message?: string; at?: string };

// Core stores the cause in sessions.error_json as {"kind","message","at"}.
// It is detail only: the label of a session comes from its durable status.
export function sessionCause(session: Pick<Session, "error">): SessionCause | null {
  const value = session.error;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined);
  const cause = { kind: text("kind"), message: text("message"), at: text("at") };
  return cause.kind || cause.message ? cause : null;
}

export function isRunHeldError(error: string): boolean {
  return error.includes(runHeldMessage);
}

// A durably running session that this process does not run belongs to another
// process or engine; it is not interrupted and must not be presented as such.
export function isRunningElsewhere(status: string | undefined, activeHere: boolean): boolean {
  return status === "running" && !activeHere;
}

type KindCopyKey =
  | "kindCancelled" | "kindMaxSteps" | "kindEmptyResponse" | "kindProviderAvailability" | "kindStaleRunRecovered"
  | "kindWorkflowGate" | "kindProviderAuth" | "kindProviderBadRequest" | "kindProviderCapacity"
  | "kindWindowOverflow" | "kindTranscriptUnpaired" | "kindConfig" | "kindStorage" | "kindPanic";
type KindCopy = Record<KindCopyKey, string>;

const kindKeys: Record<string, KindCopyKey> = {
  cancelled: "kindCancelled",
  max_steps: "kindMaxSteps",
  empty_response: "kindEmptyResponse",
  "provider:availability": "kindProviderAvailability",
  stale_run_recovered: "kindStaleRunRecovered",
  workflow_gate: "kindWorkflowGate",
  "provider:auth": "kindProviderAuth",
  "provider:bad_request": "kindProviderBadRequest",
  "provider:capacity": "kindProviderCapacity",
  window_overflow: "kindWindowOverflow",
  transcript_unpaired: "kindTranscriptUnpaired",
  config: "kindConfig",
  storage: "kindStorage",
  panic: "kindPanic",
};

// Copy for a §4.1 kind; a kind this build does not know is shown as stored.
export function kindLabel(labels: KindCopy, kind: string): string {
  const key = Object.hasOwn(kindKeys, kind) ? kindKeys[kind] : undefined;
  return key ? labels[key] : kind;
}
