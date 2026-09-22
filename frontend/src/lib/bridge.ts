import type {
  AgentConfig,
  DiscoveredModel,
  FileResult,
  GitActionResult,
  GitDiff,
  GitStatus,
  LSPConfig,
  LSPStatus,
  MCPAgentTool,
  MCPConfig,
  MCPConfigScope,
  MCPStatus,
  Message,
  MessagePage,
  ProviderConnectionResult,
  SearchResult,
  ProviderCatalog,
  ProviderCatalogScope,
  RuntimeEvent,
  Session,
  Skill,
  SkillScope,
  SessionRuntime,
  SessionUIPatch,
  ShellResult,
  SubagentNode,
  SessionCheckpoint,
  WorkspaceState,
  WorkflowSummary,
  WorktreeApplyResult,
  WorktreeConflict,
  WorktreeHandoffPlan
} from "../types";

type AppAPI = {
  PickWorkspace(): Promise<WorkspaceState>;
  OpenWorkspace(path: string): Promise<WorkspaceState>;
  GetState(): Promise<WorkspaceState>;
  ListSessions(limit: number, offset: number): Promise<Session[]>;
  GetSession(sessionId: string): Promise<Session>;
  UpdateSessionUI(sessionId: string, patch: SessionUIPatch): Promise<Session>;
  CreateSession(goal: string): Promise<Session>;
  CreateSessionWithContext(goal: string, paths: string[]): Promise<Session>;
  CreateSessionWithRuntime(goal: string, paths: string[], runtimeKind: string, base: string): Promise<Session>;
  GetSessionRuntime(sessionId: string): Promise<SessionRuntime>;
  RemoveSessionWorktree(sessionId: string, force: boolean): Promise<void>;
  WorktreeConflicts(): Promise<WorktreeConflict[]>;
  WorktreeHandoffPlan(sessionId: string): Promise<WorktreeHandoffPlan>;
  ApplySessionWorktree(sessionId: string): Promise<WorktreeApplyResult>;
  PickContextFiles(): Promise<string[]>;
  PickContextDirectory(): Promise<string[]>;
  MessagePage(sessionId: string, beforeSeq: number, limit: number): Promise<MessagePage>;
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
  SessionGitStatus(sessionId: string): Promise<GitStatus>;
  GitDiff(path: string, staged: boolean): Promise<GitDiff>;
  SessionGitDiff(sessionId: string, path: string, staged: boolean): Promise<GitDiff>;
  GitStage(path: string): Promise<GitActionResult>;
  SessionGitStage(sessionId: string, path: string): Promise<GitActionResult>;
  GitUnstage(path: string): Promise<GitActionResult>;
  SessionGitUnstage(sessionId: string, path: string): Promise<GitActionResult>;
  GitRevert(path: string): Promise<GitActionResult>;
  SessionGitRevert(sessionId: string, path: string): Promise<GitActionResult>;
  GitCommit(message: string): Promise<GitActionResult>;
  SessionGitCommit(sessionId: string, message: string): Promise<GitActionResult>;
  GitPush(): Promise<GitActionResult>;
  SessionGitPush(sessionId: string): Promise<GitActionResult>;
  RunShell(sessionId: string, command: string): Promise<ShellResult>;
  StartLSP(sessionId: string, config: LSPConfig): Promise<LSPStatus>;
  StopLSP(sessionId: string): Promise<void>;
  GetLSPStatus(sessionId: string): Promise<LSPStatus>;
  GetMCPConfigs(): Promise<MCPConfig[]>;
  GetMCPConfigsScope(scope: MCPConfigScope): Promise<MCPConfig[]>;
  SaveMCPConfig(config: MCPConfig): Promise<void>;
  SaveMCPConfigScope(scope: MCPConfigScope, config: MCPConfig): Promise<void>;
  DeleteMCPConfig(id: string): Promise<void>;
  DeleteMCPConfigScope(scope: MCPConfigScope, id: string): Promise<void>;
  StartMCP(sessionId: string, serverId: string): Promise<MCPStatus>;
  StopMCP(sessionId: string, serverId: string): Promise<void>;
  GetMCPStatuses(sessionId: string): Promise<MCPStatus[]>;
  GetMCPTools(sessionId: string): Promise<MCPAgentTool[]>;
  GetSubagentTree(parentSessionId: string): Promise<SubagentNode[]>;
  GetSessionCheckpoints(sessionId: string, limit: number): Promise<SessionCheckpoint[]>;
  RefreshMCPTools(sessionId: string, serverId: string): Promise<void>;
  GetSkills(scope: SkillScope): Promise<Skill[]>;
  GetSkillContent(scope: SkillScope, id: string): Promise<string>;
  SaveSkill(scope: SkillScope, id: string, content: string): Promise<void>;
  DeleteSkill(scope: SkillScope, id: string): Promise<void>;
  SetSkillEnabled(scope: SkillScope, id: string, enabled: boolean): Promise<void>;
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
  updateSessionUI: (sessionId: string, patch: SessionUIPatch) => api().UpdateSessionUI(sessionId, patch),
  createSession: (goal: string) => api().CreateSession(goal),
  createSessionWithContext: (goal: string, paths: string[]) => api().CreateSessionWithContext(goal, paths),
  createSessionWithRuntime: (goal: string, paths: string[], runtimeKind: string, base = "HEAD") => api().CreateSessionWithRuntime(goal, paths, runtimeKind, base),
  sessionRuntime: (sessionId: string) => api().GetSessionRuntime(sessionId),
  removeSessionWorktree: (sessionId: string, force = false) => api().RemoveSessionWorktree(sessionId, force),
  worktreeConflicts: () => api().WorktreeConflicts(),
  worktreeHandoffPlan: (sessionId: string) => api().WorktreeHandoffPlan(sessionId),
  applySessionWorktree: (sessionId: string) => api().ApplySessionWorktree(sessionId),
  pickContextFiles: () => api().PickContextFiles(),
  pickContextDirectory: () => api().PickContextDirectory(),
  messagePage: (sessionId: string, beforeSeq = -1, limit = 100) => api().MessagePage(sessionId, beforeSeq, limit),
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
  sessionGitStatus: (sessionId: string) => api().SessionGitStatus(sessionId),
  gitDiff: (path = "", staged = false) => api().GitDiff(path, staged),
  sessionGitDiff: (sessionId: string, path = "", staged = false) => api().SessionGitDiff(sessionId, path, staged),
  gitStage: (path: string) => api().GitStage(path),
  sessionGitStage: (sessionId: string, path: string) => api().SessionGitStage(sessionId, path),
  gitUnstage: (path: string) => api().GitUnstage(path),
  sessionGitUnstage: (sessionId: string, path: string) => api().SessionGitUnstage(sessionId, path),
  gitRevert: (path: string) => api().GitRevert(path),
  sessionGitRevert: (sessionId: string, path: string) => api().SessionGitRevert(sessionId, path),
  gitCommit: (message: string) => api().GitCommit(message),
  sessionGitCommit: (sessionId: string, message: string) => api().SessionGitCommit(sessionId, message),
  gitPush: () => api().GitPush(),
  sessionGitPush: (sessionId: string) => api().SessionGitPush(sessionId),
  runShell: (sessionId: string, command: string) => api().RunShell(sessionId, command),
  startLSP: (sessionId: string, config: LSPConfig) => api().StartLSP(sessionId, config),
  stopLSP: (sessionId: string) => api().StopLSP(sessionId),
  lspStatus: (sessionId: string) => api().GetLSPStatus(sessionId),
  mcpConfigs: () => api().GetMCPConfigs(),
  mcpConfigsScope: (scope: MCPConfigScope) => api().GetMCPConfigsScope(scope),
  saveMCPConfig: (config: MCPConfig) => api().SaveMCPConfig(config),
  saveMCPConfigScope: (scope: MCPConfigScope, config: MCPConfig) => api().SaveMCPConfigScope(scope, config),
  deleteMCPConfig: (id: string) => api().DeleteMCPConfig(id),
  deleteMCPConfigScope: (scope: MCPConfigScope, id: string) => api().DeleteMCPConfigScope(scope, id),
  startMCP: (sessionId: string, serverId: string) => api().StartMCP(sessionId, serverId),
  stopMCP: (sessionId: string, serverId: string) => api().StopMCP(sessionId, serverId),
  mcpStatuses: (sessionId: string) => api().GetMCPStatuses(sessionId),
  mcpTools: (sessionId: string) => api().GetMCPTools(sessionId),
  refreshMCPTools: (sessionId: string, serverId: string) => api().RefreshMCPTools(sessionId, serverId),
  subagentTree: (parentSessionId: string) => api().GetSubagentTree(parentSessionId),
  sessionCheckpoints: (sessionId: string, limit = 20) => api().GetSessionCheckpoints(sessionId, limit)
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
