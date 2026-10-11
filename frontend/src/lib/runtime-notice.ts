export type RuntimeNoticeCopy = Record<
  "originToolInterrupted" | "originToolInterruptedBody" | "originCompletionBlocked" | "originResume" | "originTurn",
  string
>;

export type RuntimeNotice = { title: string; body: string };

// Rows the runtime wrote carry `origin` in their stored JSON. The copy is
// centralized; an origin this build does not know keeps its raw value as the title.
export function runtimeNotice(labels: RuntimeNoticeCopy, origin: string, content: string): RuntimeNotice {
  switch (origin) {
    case "tool_interrupted":
      return { title: labels.originToolInterrupted, body: labels.originToolInterruptedBody };
    case "completion_blocked":
      return { title: labels.originCompletionBlocked, body: content };
    case "resume":
      return { title: labels.originResume, body: content };
    case "turn":
      return { title: labels.originTurn, body: content };
    default:
      return { title: origin, body: content };
  }
}
