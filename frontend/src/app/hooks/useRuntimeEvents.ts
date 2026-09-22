import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { bridge, onRuntimeEvent } from "../../lib/bridge";
import type { RuntimeEvent, WorkspaceState } from "../../types";

const MAX_VISIBLE_EVENTS = 180;

type Options = {
  selectedSessionId: string;
  setWorkspaceState: Dispatch<SetStateAction<WorkspaceState>>;
  refreshLSPStatus: () => Promise<void>;
  handleSessionRuntimeEvent: (event: RuntimeEvent) => void;
};

export function useRuntimeEvents({
  selectedSessionId,
  setWorkspaceState,
  refreshLSPStatus,
  handleSessionRuntimeEvent,
}: Options) {
  const [events, setEvents] = useState<RuntimeEvent[]>([]);

  useEffect(() => onRuntimeEvent((event) => {
    setEvents((current) => [...current, event].slice(-MAX_VISIBLE_EVENTS));

    if (
      event.type === "run.started" ||
      event.type === "run.stopped" ||
      event.type === "session.complete" ||
      event.type === "session.interrupted" ||
      event.type === "workflow.gate_waiting" ||
      event.type === "workflow.approved"
    ) {
      bridge.state().then(setWorkspaceState).catch(() => undefined);
    }

    if (
      event.type === "lsp.started" ||
      event.type === "lsp.stopped" ||
      (event.type === "tool.end" && event.sessionId === selectedSessionId)
    ) {
      void refreshLSPStatus();
    }

    handleSessionRuntimeEvent(event);
  }), [
    handleSessionRuntimeEvent,
    refreshLSPStatus,
    selectedSessionId,
    setWorkspaceState,
  ]);

  return {
    events,
    clearEvents: () => setEvents([]),
  };
}
