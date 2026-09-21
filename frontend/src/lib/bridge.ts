import type { RuntimeEvent, Session, ShellResult, WorkspaceState } from "../types";

type AppAPI = {
  PickWorkspace(): Promise<WorkspaceState>;
  OpenWorkspace(path: string): Promise<WorkspaceState>;
  GetState(): Promise<WorkspaceState>;
  ListSessions(limit: number, offset: number): Promise<Session[]>;
  CreateSession(goal: string): Promise<Session>;
  RunShell(sessionId: string, command: string): Promise<ShellResult>;
};

declare global {
  interface Window {
    go?: { main?: { App?: AppAPI } };
    runtime?: {
      EventsOn?: (name: string, callback: (...args: unknown[]) => void) => unknown;
      EventsOff?: (name: string) => void;
    };
  }
}

function api(): AppAPI {
  const app = window.go?.main?.App;
  if (!app) {
    throw new Error("Wails bridge is not available. Run the UI through 'wails dev'.");
  }
  return app;
}

export const bridge = {
  state: () => api().GetState(),
  pickWorkspace: () => api().PickWorkspace(),
  openWorkspace: (path: string) => api().OpenWorkspace(path),
  listSessions: (limit = 100, offset = 0) => api().ListSessions(limit, offset),
  createSession: (goal: string) => api().CreateSession(goal),
  runShell: (sessionId: string, command: string) => api().RunShell(sessionId, command)
};

export function onRuntimeEvent(callback: (event: RuntimeEvent) => void): () => void {
  const eventsOn = window.runtime?.EventsOn;
  if (!eventsOn) {
    return () => undefined;
  }
  const maybeCancel = eventsOn("runtime:event", (...args: unknown[]) => {
    const event = (args.length === 1 ? args[0] : args) as RuntimeEvent;
    callback(event);
  });
  if (typeof maybeCancel === "function") {
    return maybeCancel as () => void;
  }
  return () => window.runtime?.EventsOff?.("runtime:event");
}
