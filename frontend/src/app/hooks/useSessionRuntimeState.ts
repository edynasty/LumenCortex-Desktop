import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import type {
  Message,
  RuntimeEvent,
  SessionCheckpoint,
  SubagentNode,
  WorkflowSummary,
  WorkspaceState,
} from "../../types";

const MESSAGE_PAGE_SIZE = 100;
const MAX_LOADED_MESSAGES = 500;

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const bySeq = new Map<number, Message>();
  for (const message of current) bySeq.set(message.seq, message);
  for (const message of incoming) bySeq.set(message.seq, message);
  return Array.from(bySeq.values()).sort((a, b) => a.seq - b.seq);
}

type Options = {
  selectedSessionId: string;
  setWorkspaceState: Dispatch<SetStateAction<WorkspaceState>>;
  setError: Dispatch<SetStateAction<string>>;
};

export function useSessionRuntimeState({
  selectedSessionId,
  setWorkspaceState,
  setError,
}: Options) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [atLatest, setAtLatest] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [workflowSummary, setWorkflowSummary] = useState<WorkflowSummary | null>(null);
  const [subagents, setSubagents] = useState<SubagentNode[]>([]);
  const [checkpoints, setCheckpoints] = useState<SessionCheckpoint[]>([]);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      setAtLatest(true);
      setWorkflowSummary(null);
      setSubagents([]);
      setCheckpoints([]);
      return;
    }

    let cancelled = false;
    Promise.all([
      bridge.messagePage(selectedSessionId, -1, MESSAGE_PAGE_SIZE),
      bridge.workflowSummary(selectedSessionId),
      bridge.subagentTree(selectedSessionId),
      bridge.sessionCheckpoints(selectedSessionId, 20),
    ]).then(([page, summary, nextSubagents, nextCheckpoints]) => {
      if (cancelled) return;
      setMessages(page.messages);
      setAtLatest(true);
      setWorkflowSummary(summary);
      setSubagents(nextSubagents);
      setCheckpoints(nextCheckpoints);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  const reset = useCallback(() => {
    setMessages([]);
    setAtLatest(true);
    setLoadingOlder(false);
    setWorkflowSummary(null);
    setSubagents([]);
    setCheckpoints([]);
  }, []);

  const replaceWorkflowSummary = useCallback((summary: WorkflowSummary | null) => {
    setWorkflowSummary(summary);
  }, []);

  const refreshCurrent = useCallback(async (sessionId = selectedSessionId) => {
    if (!sessionId) return;
    const [session, page, summary, nextSubagents, nextCheckpoints] = await Promise.all([
      bridge.getSession(sessionId),
      bridge.messagePage(sessionId, -1, MESSAGE_PAGE_SIZE),
      bridge.workflowSummary(sessionId),
      bridge.subagentTree(sessionId),
      bridge.sessionCheckpoints(sessionId, 20),
    ]);
    if (sessionId === selectedSessionId) {
      setMessages(page.messages);
      setAtLatest(true);
      setWorkflowSummary(summary);
      setSubagents(nextSubagents);
      setCheckpoints(nextCheckpoints);
    }
    setWorkspaceState((current) => ({
      ...current,
      sessions: current.sessions.map((item) => item.id === session.id ? session : item),
    }));
  }, [selectedSessionId, setWorkspaceState]);

  const loadOlder = useCallback(async () => {
    if (!selectedSessionId || loadingOlder || messages.length === 0) return;
    const before = messages[0].seq;
    if (before <= 0) return;

    setLoadingOlder(true);
    try {
      const page = await bridge.messagePage(selectedSessionId, before, MESSAGE_PAGE_SIZE);
      setMessages((current) => {
        const merged = mergeMessages(page.messages, current);
        if (merged.length > MAX_LOADED_MESSAGES) {
          setAtLatest(false);
          return merged.slice(0, MAX_LOADED_MESSAGES);
        }
        return merged;
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, messages, selectedSessionId, setError]);

  const jumpToLatest = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoadingOlder(true);
    try {
      const page = await bridge.messagePage(selectedSessionId, -1, MESSAGE_PAGE_SIZE);
      setMessages(page.messages);
      setAtLatest(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingOlder(false);
    }
  }, [selectedSessionId, setError]);

  const handleRuntimeEvent = useCallback((event: RuntimeEvent) => {
    if (!selectedSessionId || event.sessionId !== selectedSessionId) return;

    if (
      event.type === "subagent.spawned" ||
      event.type === "subagent.event" ||
      event.type === "subagent.stopped"
    ) {
      Promise.all([
        bridge.subagentTree(selectedSessionId),
        bridge.sessionCheckpoints(selectedSessionId, 20),
      ]).then(([nextSubagents, nextCheckpoints]) => {
        setSubagents(nextSubagents);
        setCheckpoints(nextCheckpoints);
      }).catch(() => undefined);
    }

    if (
      event.type === "session.complete" ||
      event.type === "session.interrupted" ||
      event.type === "tool.end" ||
      event.type === "workflow.transition" ||
      event.type === "workflow.gate_waiting" ||
      event.type === "workflow.approved"
    ) {
      Promise.all([
        atLatest ? bridge.messagePage(selectedSessionId, -1, MESSAGE_PAGE_SIZE) : Promise.resolve(null),
        bridge.workflowSummary(selectedSessionId),
      ]).then(([page, summary]) => {
        if (page) {
          setMessages((current) =>
            mergeMessages(current, page.messages).slice(-MAX_LOADED_MESSAGES)
          );
        }
        setWorkflowSummary(summary);
      }).catch(() => undefined);
    }
  }, [atLatest, selectedSessionId]);

  return {
    messages,
    atLatest,
    loadingOlder,
    workflowSummary,
    subagents,
    checkpoints,
    refreshCurrent,
    loadOlder,
    jumpToLatest,
    handleRuntimeEvent,
    reset,
    replaceWorkflowSummary,
  };
}
