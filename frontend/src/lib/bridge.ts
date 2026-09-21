import type {
  AgentConfig,
  DiscoveredModel,
  FileResult,
  GitDiff,
  GitStatus,
  Message,
  ProviderConnectionResult,
  SearchResult,
  ProviderCatalog,
  ProviderCatalogScope,
  RuntimeEvent,
  Session,
  ShellResult,
  WorkspaceState,
  WorkflowSummary
} from "../types";

type AppAPI = {
  PickWorkspace(): Promise<WorkspaceState>;
  OpenWorkspace(path: string): Promise<WorkspaceState>;
  GetState(): Promise<WorkspaceState>;
  ListSessions(limit: number, offset: number): Promise<Session[]>;
  GetSession(sessionId: string): Promise<Session>;
  CreateSession(goal: string): Promise<Session>;
  RecentMessages(sessionId: string, limit: number): Promise<Message[]>;
  DiscoverProviderModels(providerId: string): Promise<DiscoveredModel[]>;
  TestProviderConnection(providerId: string): Promise<ProviderConnectionResult>;
  GetProviderCatalog(): Promise<ProviderCatalog>;
  SaveProviderCatalog(config: ProviderCatalog): Promise<ProviderCatalog>;
  GetProviderCatalogScope(scope: ProviderCatalogScope): Promise<ProviderCatalog>;
  SaveProviderCatalogScope(scope: ProviderCatalogScope, config: ProviderCatalog): Promise<ProviderCatalog>;
  StartAgent(sessionId: string, config: AgentConfig): Promise<Session>;
  ContinueAgent(sessionId: string, content: string, config: AgentConfig): Promise<Session>;
  CancelAgent(sessionId: string): Promise<boolean>;
  GetWorkflowSummary(sessionId: string): Promise<WorkflowSummary | null>;
  ApproveWorkflowGate(sessionId: string, gateId: string): Promise<WorkflowSummary>;
  SearchText(query: string, path: string, limit: number): Promise<SearchResult>;
  FindFiles(pattern: string, path: string, limit: number): Promise<FileResult>;
  GitStatus(): Promise<GitStatus>;
  GitDiff(path: string, staged: boolean): Promise<GitDiff>;
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
  getSession: (sessionId: string) => api().GetSession(sessionId),
  createSession: (goal: string) => api().CreateSession(goal),
  recentMessages: (sessionId: string, limit = 80) => api().RecentMessages(sessionId, limit),
  discoverProviderModels: (providerId: string) => api().DiscoverProviderModels(providerId),
  testProviderConnection: (providerId: string) => api().TestProviderConnection(providerId),
  providerCatalog: () => api().GetProviderCatalog(),
  saveProviderCatalog: (config: ProviderCatalog) => api().SaveProviderCatalog(config),
  providerCatalogScope: (scope: ProviderCatalogScope) => api().GetProviderCatalogScope(scope),
  saveProviderCatalogScope: (scope: ProviderCatalogScope, config: ProviderCatalog) => api().SaveProviderCatalogScope(scope, config),
  startAgent: (sessionId: string, config: AgentConfig) => api().StartAgent(sessionId, config),
  continueAgent: (sessionId: string, content: string, config: AgentConfig) => api().ContinueAgent(sessionId, content, config),
  cancelAgent: (sessionId: string) => api().CancelAgent(sessionId),
  workflowSummary: (sessionId: string) => api().GetWorkflowSummary(sessionId),
  approveWorkflowGate: (sessionId: string, gateId: string) => api().ApproveWorkflowGate(sessionId, gateId),
  searchText: (query: string, path = "", limit = 200) => api().SearchText(query, path, limit),
  findFiles: (pattern: string, path = "", limit = 200) => api().FindFiles(pattern, path, limit),
  gitStatus: () => api().GitStatus(),
  gitDiff: (path = "", staged = false) => api().GitDiff(path, staged),
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
