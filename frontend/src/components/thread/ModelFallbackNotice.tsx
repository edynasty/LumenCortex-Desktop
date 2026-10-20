import { useMemo } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { currentFallback } from "../../lib/model-fallback";
import type { RuntimeEvent } from "../../types";
import { Icon } from "../primitives/Icon";

type Labels = Pick<AppCopy, "modelFallbackNotice" | "fallbackReasonAvailability" | "fallbackReasonCapacity">;

// ModelFallbackNotice says which model answered the thread's current run when its first model
// failed and Core moved down the agent's list. The pin is unchanged; the next run starts there again.
export function ModelFallbackNotice({ events, sessionId, labels }: { events: RuntimeEvent[]; sessionId: string; labels: Labels }) {
  const fallback = useMemo(() => currentFallback(events, sessionId), [events, sessionId]);
  if (!fallback) return null;
  const reason =
    fallback.reason === "availability" ? labels.fallbackReasonAvailability :
    fallback.reason === "capacity" ? labels.fallbackReasonCapacity :
    fallback.reason;
  const text = labels.modelFallbackNotice
    .replaceAll("{answeredBy}", fallback.answeredBy)
    .replaceAll("{from}", fallback.from)
    .replaceAll("{reason}", reason);
  return (
    <p className="notice-line tone-info" role="status">
      <Icon name="model" size={14} />
      {text}
    </p>
  );
}
