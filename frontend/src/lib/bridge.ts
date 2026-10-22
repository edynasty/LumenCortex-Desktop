import type {
  AgentCatalog,
  AgentConfig,
  AgentEntry,
  SubagentModelMigration,
  DiscoveredModel,
  FileResult,
  GitActionResult,
  GitDiff,
  GitStatus,
  LSPConfig,
  LSPDiagnostic,
  LSPStatus,
  MCPAgentTool,
  MCPConfig,
  CheckArtifact,
  CheckResult,
  ChecksInfo,
  MCPConfigScope,
  MCPStatus,
  Message,
  MessagePage,
  OMPImportPreview,
  OMPImportResult,
  OMPListOptions,
  OMPSessionSummary,
  AgentConcurrency,
  ConfigState,
  CredentialStatus,
  ProviderCatalogDocument,
  ProviderCatalogScope,
  ProviderConnectionResult,
  SearchResult,
  RuntimeEvent,
  Session,
  Skill,
  SkillScope,
  SessionRuntime,
  SessionUIPatch,
  ShellResult,
  SubagentNode,
  ExecutionTask,
  TaskNoteEdit,
  TaskReferenceEdit,
  TaskResolutionState,
  TaskStateInfo,
  ThreadNoteView,
  ToolPermissions,
  SessionCheckpoint,
  WorkspaceState,
  WorkflowSummary,
  WorktreeApplyResult,
  WorktreeCleanup,
  WorktreeCleanupOutcome,
  WorktreeConflict,
  WorktreeHandoffPlan,
  WorktreeInspection,
  DeleteSessionOutcome
} from "../types";

export type AppAPI = {
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
  InspectSessionWorktree(sessionId: string): Promise<WorktreeInspection>;
  RemoveSessionWorktree(sessionId: string, cleanup: WorktreeCleanup): Promise<WorktreeCleanupOutcome>;
  DeleteSession(sessionId: string, cleanup: WorktreeCleanup): Promise<DeleteSessionOutcome>;
  WorktreeConflicts(): Promise<WorktreeConflict[]>;
  WorktreeHandoffPlan(sessionId: string): Promise<WorktreeHandoffPlan>;
  ApplySessionWorktree(sessionId: string): Promise<WorktreeApplyResult>;
  PickContextFiles(): Promise<string[]>;
  PickContextDirectory(): Promise<string[]>;
  MessagePage(sessionId: string, beforeSeq: number, limit: number): Promise<MessagePage>;
  RecentMessages(sessionId: string, limit: number): Promise<Message[]>;
  DiscoverProviderModels(providerId: string): Promise<DiscoveredModel[]>;
  TestProviderConnection(providerId: string): Promise<ProviderConnectionResult>;
  GetConfigState(): Promise<ConfigState>;
  TrustWorkspace(globalDigest: string): Promise<ConfigState>;
  SaveConcurrency(globalDigest: string, limits: AgentConcurrency): Promise<ConfigState>;
  GetProviderCatalogScope(scope: ProviderCatalogScope): Promise<ProviderCatalogDocument>;
  GetProviderCredentialStatus(scope: ProviderCatalogScope, providerID: string): Promise<CredentialStatus>;
  SaveProviderCredential(scope: ProviderCatalogScope, providerID: string, apiKey: string): Promise<CredentialStatus>;
  RemoveProviderCredential(scope: ProviderCatalogScope, providerID: string): Promise<CredentialStatus>;
  SaveProviderCatalogScope(scope: ProviderCatalogScope, doc: ProviderCatalogDocument): Promise<ProviderCatalogDocument>;
  StartAgent(sessionId: string, config: AgentConfig): Promise<Session>;
  ContinueAgent(sessionId: string, content: string, config: AgentConfig): Promise<Session>;
  StartProposedTask(parentSessionId: string, taskId: string): Promise<ExecutionTask>;
  CancelSubtree(sessionId: string): Promise<string[]>;
  GetWorkflowSummary(sessionId: string): Promise<WorkflowSummary | null>;
  ApproveWorkflowGate(sessionId: string, gateId: string): Promise<WorkflowSummary>;
  GetTaskState(sessionId: string): Promise<TaskStateInfo>;
  SetTaskBrief(sessionId: string, brief: string): Promise<TaskStateInfo>;
  EditTaskReference(sessionId: string, edit: TaskReferenceEdit): Promise<TaskStateInfo>;
  EditTaskNote(sessionId: string, edit: TaskNoteEdit): Promise<TaskStateInfo>;
  ThreadNotes(sessionId: string): Promise<ThreadNoteView[]>;
  ResolveThread(sessionId: string, state: TaskResolutionState): Promise<TaskStateInfo>;
  ResetContext(sessionId: string): Promise<TaskStateInfo>;
  GetSessionChecks(sessionId: string): Promise<ChecksInfo>;
  GetCheckResults(sessionId: string, beforeSeq: number, limit: number): Promise<CheckResult[] | null>;
  GetCheckArtifact(sessionId: string, hash: string): Promise<CheckArtifact>;
  AcceptCheck(sessionId: string, checkId: string): Promise<CheckResult>;
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
  GetLSPDiagnostics(sessionId: string, path: string): Promise<LSPDiagnostic[]>;
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
  GetToolPermissions(): Promise<ToolPermissions>;
  SaveToolPermissions(value: ToolPermissions): Promise<ToolPermissions>;
  GetAgents(): Promise<AgentCatalog>;
  GetAgentPresets(): Promise<AgentEntry[]>;
  ListOMPSessions(opts: OMPListOptions): Promise<OMPSessionSummary[]>;
  PreviewOMPSession(path: string): Promise<OMPImportPreview>;
  ImportOMPSession(path: string): Promise<OMPImportResult>;
  SaveAgent(globalDigest: string, agent: AgentEntry): Promise<AgentCatalog>;
  DeleteAgent(globalDigest: string, id: string): Promise<AgentCatalog>;
  MigrateSubagentModel(): Promise<SubagentModelMigration>;
  TitleBarDoubleClick(): Promise<void>;
  SetMenuLocale(locale: string): Promise<boolean>;
};

declare global {
  interface Window {
    go?: { main?: { App?: AppAPI } };
    runtime?: {
      EventsOn?: (name: string, callback: (...args: unknown[]) => void) => unknown;
      EventsOff?: (name: string) => void;
      WindowSetBackgroundColour?: (r: number, g: number, b: number, a: number) => void;
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
  inspectSessionWorktree: (sessionId: string) => api().InspectSessionWorktree(sessionId),
  removeSessionWorktree: (sessionId: string, cleanup: WorktreeCleanup = {}) => api().RemoveSessionWorktree(sessionId, cleanup),
  deleteSession: (sessionId: string, cleanup: WorktreeCleanup = {}) => api().DeleteSession(sessionId, cleanup),
  worktreeConflicts: () => api().WorktreeConflicts(),
  worktreeHandoffPlan: (sessionId: string) => api().WorktreeHandoffPlan(sessionId),
  applySessionWorktree: (sessionId: string) => api().ApplySessionWorktree(sessionId),
  pickContextFiles: () => api().PickContextFiles(),
  pickContextDirectory: () => api().PickContextDirectory(),
  messagePage: (sessionId: string, beforeSeq = -1, limit = 100) => api().MessagePage(sessionId, beforeSeq, limit),
  recentMessages: (sessionId: string, limit = 80) => api().RecentMessages(sessionId, limit),
  discoverProviderModels: (providerId: string) => api().DiscoverProviderModels(providerId),
  testProviderConnection: (providerId: string) => api().TestProviderConnection(providerId),
  configState: () => api().GetConfigState(),
  trustWorkspace: (globalDigest: string) => api().TrustWorkspace(globalDigest),
  saveConcurrency: (globalDigest: string, limits: AgentConcurrency) => api().SaveConcurrency(globalDigest, limits),
  providerCatalogScope: (scope: ProviderCatalogScope) => api().GetProviderCatalogScope(scope),
  providerCredentialStatus: (scope: ProviderCatalogScope, providerId: string) => api().GetProviderCredentialStatus(scope, providerId),
  saveProviderCredential: (scope: ProviderCatalogScope, providerId: string, apiKey: string) => api().SaveProviderCredential(scope, providerId, apiKey),
  removeProviderCredential: (scope: ProviderCatalogScope, providerId: string) => api().RemoveProviderCredential(scope, providerId),
  saveProviderCatalogScope: (scope: ProviderCatalogScope, doc: ProviderCatalogDocument) => api().SaveProviderCatalogScope(scope, doc),
  startAgent: (sessionId: string, config: AgentConfig) => api().StartAgent(sessionId, config),
  continueAgent: (sessionId: string, content: string, config: AgentConfig) => api().ContinueAgent(sessionId, content, config),
  startProposedTask: (parentSessionId: string, taskId: string) => api().StartProposedTask(parentSessionId, taskId),
  cancelSubtree: (sessionId: string) => api().CancelSubtree(sessionId),
  workflowSummary: (sessionId: string) => api().GetWorkflowSummary(sessionId),
  approveWorkflowGate: (sessionId: string, gateId: string) => api().ApproveWorkflowGate(sessionId, gateId),
  taskState: (sessionId: string) => api().GetTaskState(sessionId),
  setTaskBrief: (sessionId: string, brief: string) => api().SetTaskBrief(sessionId, brief),
  editTaskReference: (sessionId: string, edit: TaskReferenceEdit) => api().EditTaskReference(sessionId, edit),
  editTaskNote: (sessionId: string, edit: TaskNoteEdit) => api().EditTaskNote(sessionId, edit),
  threadNotes: (sessionId: string) => api().ThreadNotes(sessionId),
  resolveThread: (sessionId: string, state: TaskResolutionState) => api().ResolveThread(sessionId, state),
  resetContext: (sessionId: string) => api().ResetContext(sessionId),
  sessionChecks: (sessionId: string) => api().GetSessionChecks(sessionId),
  checkResults: (sessionId: string, beforeSeq = -1, limit = 20) => api().GetCheckResults(sessionId, beforeSeq, limit),
  checkArtifact: (sessionId: string, hash: string) => api().GetCheckArtifact(sessionId, hash),
  acceptCheck: (sessionId: string, checkId: string) => api().AcceptCheck(sessionId, checkId),
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
  lspDiagnostics: (sessionId: string, path: string) => api().GetLSPDiagnostics(sessionId, path),
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
  skills: (scope: SkillScope) => api().GetSkills(scope),
  skillContent: (scope: SkillScope, id: string) => api().GetSkillContent(scope, id),
  saveSkill: (scope: SkillScope, id: string, content: string) => api().SaveSkill(scope, id, content),
  deleteSkill: (scope: SkillScope, id: string) => api().DeleteSkill(scope, id),
  setSkillEnabled: (scope: SkillScope, id: string, enabled: boolean) => api().SetSkillEnabled(scope, id, enabled),
  toolPermissions: () => api().GetToolPermissions(),
  saveToolPermissions: (value: ToolPermissions) => api().SaveToolPermissions(value),
  agents: () => api().GetAgents(),
  agentPresets: () => api().GetAgentPresets(),
  // OMP session import (ADR-0011): list, preview and import always read OMP's default directory.
  ompSessions: (opts: OMPListOptions = {}) => api().ListOMPSessions(opts),
  previewOMPSession: (path: string) => api().PreviewOMPSession(path),
  importOMPSession: (path: string) => api().ImportOMPSession(path),
  saveAgent: (globalDigest: string, agent: AgentEntry) => api().SaveAgent(globalDigest, agent),
  deleteAgent: (globalDigest: string, id: string) => api().DeleteAgent(globalDigest, id),
  migrateSubagentModel: () => api().MigrateSubagentModel(),
  subagentTree: (parentSessionId: string) => api().GetSubagentTree(parentSessionId),
  sessionCheckpoints: (sessionId: string, limit = 20) => api().GetSessionCheckpoints(sessionId, limit),
  titleBarDoubleClick: () => api().TitleBarDoubleClick(),
  /** Rebuilds the native menu bar in the app language; true when a native menu is installed. */
  setMenuLocale: (locale: string) => api().SetMenuLocale(locale)
};

/** The native window's background, shown wherever the webview has not painted (launch, live resize). */
export function setWindowBackground(r: number, g: number, b: number): void {
  window.runtime?.WindowSetBackgroundColour?.(r, g, b, 255);
}

/** Commands the native menu bar sends: see menu.go. */
export type MenuCommand = "new-thread" | "settings" | "palette" | "toggle-sidebar";

export function onMenuCommand(callback: (command: MenuCommand) => void): () => void {
  const eventsOn = window.runtime?.EventsOn;
  if (!eventsOn) return () => undefined;
  const cancel = eventsOn("menu:command", (...args: unknown[]) => callback(args[0] as MenuCommand));
  return typeof cancel === "function" ? (cancel as () => void) : () => undefined;
}

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

/**
 * True inside the macOS Wails window, whose native traffic lights float over the web toolbar
 * (main.go TitleBarHiddenInset). Wails loads its runtime script before the app module, so this
 * is synchronous; a plain browser has no `window.runtime`.
 */
export function isNativeMacWindow(): boolean {
  return typeof window !== "undefined" && Boolean(window.runtime) && /^Mac/.test(navigator.platform);
}
