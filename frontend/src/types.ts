export type SkillScope = "global" | "project" | "effective";

export type Skill = {
  id: string;
  name: string;
  description?: string;
  scope: "global" | "project";
  path: string;
  enabled: boolean;
  overridden?: boolean;
  bytes?: number;
  error?: string;
};

export type MCPProtocolMode = "legacy" | "modern";
export type MCPConfigScope = "global" | "project" | "effective";

export type MCPConfig = {
  id: string;
  name?: string;
  command: string;
  args?: string[];
  workspace?: string;
  protocolMode?: MCPProtocolMode;
  disabled?: boolean;
};

export type MCPStatus = {
  id: string;
  name?: string;
  command?: string;
  workspace?: string;
  protocolMode: MCPProtocolMode;
  protocolVersion?: string;
  running: boolean;
  pid?: number;
  pendingRequests: number;
  tools: number;
  lastError?: string;
};

export type MCPAgentTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
  toolName: string;
  readOnly: boolean;
};

export type LSPPosition = {
  line: number;
  character: number;
};

export type LSPRange = {
  start: LSPPosition;
  end: LSPPosition;
};

export type LSPDiagnostic = {
  range: LSPRange;
  severity?: number;
  code?: unknown;
  source?: string;
  message: string;
};

export type LSPConfig = {
  name?: string;
  command: string;
  args?: string[];
  languageId?: string;
  workspace?: string;
};

export type LSPStatus = {
  running: boolean;
  name?: string;
  command?: string;
  pid?: number;
  pendingRequests: number;
  diagnostics: number;
  lastError?: string;
};

export type Budget = {
  softBytes: number;
  hardBytes: number;
  maxAgents: number;
};

export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requests?: number;
};

export type Health = {
  version: string;
  workspace: string;
  database: string;
  budget: Budget;
  usedBytes: number;
  activeAgents?: number;
  pressure: boolean;
};

export type RuntimeKind = "local" | "worktree";

export type SessionRuntime = {
  kind: RuntimeKind;
  path: string;
  branch?: string;
  base?: string;
  head?: string;
};

export type RuntimeOwner = {
  sessionId?: string;
  kind: RuntimeKind;
  path: string;
  branch?: string;
};

export type WorktreeConflict = {
  path: string;
  owners: RuntimeOwner[];
};

export type WorktreeHandoffPlan = {
  sessionId: string;
  runtime: SessionRuntime;
  targetBranch?: string;
  targetHead?: string;
  sourceHead?: string;
  commits: string[];
  sourceFiles: string[];
  targetFiles: string[];
  overlappingFiles: string[];
  sourceDirty: boolean;
  targetDirty: boolean;
  canApply: boolean;
  blockedReason?: string;
};

export type WorktreeApplyResult = {
  plan: WorktreeHandoffPlan;
  action: GitActionResult;
  targetHead: string;
};

export type SubagentNode = {
  sessionId: string;
  parentSessionId?: string;
  goal: string;
  status: string;
  final?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  runtime: SessionRuntime;
  children?: SubagentNode[];
};

export type SessionCheckpoint = {
  sessionId: string;
  seq: number;
  at: string;
  reason: string;
  json: unknown;
};

export type SessionUIPatch = {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
};

export type Session = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  provider?: string;
  model?: string;
  goal: string;
  metadata?: unknown;
  final?: string;
  usage?: Usage;
  error?: { message?: string } | unknown;
};

export type ActiveRun = {
  sessionId: string;
  startedAt: string;
  cancelRequested?: boolean;
};

export type WorkflowGateSummary = {
  id: string;
  type: string;
  title: string;
  description: string;
};

export type WorkflowSummary = {
  id: string;
  title: string;
  currentAction: string;
  currentTitle: string;
  terminal: boolean;
  status: string;
  allowedTools?: string[];
  canFinish: boolean;
  pendingGates: WorkflowGateSummary[];
  facts: Record<string, unknown>;
};

export type WorkspaceState = {
  workspace: string;
  health?: Health;
  sessions: Session[];
  activeRuns: ActiveRun[];
};

export type RuntimeEvent = {
  seq: number;
  at: string;
  type: string;
  sessionId?: string;
  data?: Record<string, unknown>;
};

export type Message = {
  sessionId: string;
  seq: number;
  role: string;
  json: unknown;
};

export type MessagePage = {
  messages: Message[];
  hasMore: boolean;
  nextBefore: number;
};



export type ProviderConfig = {
  endpoint?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  disableStreaming?: boolean;
  disableRetries?: boolean;
};

export type DiscoveredModel = {
  id: string;
};

export type ProviderConnectionResult = {
  ok: boolean;
  models: number;
  message: string;
};

export type ProviderModel = {
  name?: string;
  modelID?: string;
  limit?: { context?: number; output?: number };
};

export type ProviderDefinition = {
  name?: string;
  package?: string;
  settings?: {
    baseURL?: string;
    endpoint?: string;
    apiKey?: string;
  };
  models?: Record<string, ProviderModel>;
};

export type ProviderCatalog = {
  $schema?: string;
  model?: string;
  providers: Record<string, ProviderDefinition>;
};

export type ProviderCatalogScope = "global" | "workspace";

export type AgentConfig = {
  provider: ProviderConfig;
  modelRef?: string;
  policy?: "read-only" | "workspace" | "full";
  maxSteps?: number;
  recentMessages?: number;
  maxToolCallsPerStep?: number;
  maxTokens?: number;
  temperature?: number;
};

export type SearchMatch = {
  path: string;
  line: number;
  column?: number;
  text: string;
};

export type SearchResult = {
  matches: SearchMatch[];
  truncated: boolean;
  engine: string;
};

export type FileResult = {
  paths: string[];
  truncated: boolean;
};

export type GitFileStatus = {
  path: string;
  index: string;
  worktree: string;
};

export type GitStatus = {
  files: GitFileStatus[];
};

export type GitDiff = {
  path?: string;
  content: string;
  bytes: number;
  truncated: boolean;
  staged: boolean;
};

export type GitActionResult = {
  output: string;
  truncated: boolean;
};

export type ShellResult = {
  command: string;
  exitCode: number;
  duration: number;
  stdout: { total: number; truncated: boolean };
  stderr: { total: number; truncated: boolean };
  cancelled: boolean;
};
