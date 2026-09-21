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
