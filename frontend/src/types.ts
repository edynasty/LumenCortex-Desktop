export type ToolPermissions = {
  disabled: string[];
};

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

// Core's view of what a worktree cleanup would act on (ADR-0005). role is "" for a
// session without a worktree.
export type WorktreeRole = "" | "owner" | "borrower" | "uncertain";

export type WorktreeInspection = {
  sessionId: string;
  role?: WorktreeRole;
  owner?: string;
  path?: string;
  branch?: string;
  exists: boolean;
  registered: boolean;
  branchExists: boolean;
  head?: string;
  targetHead?: string;
  dirtyFiles?: string[];
  ignoredFiles?: string[];
  ignoredTruncated?: boolean;
  statusDigest?: string;
  unappliedCommits?: string[];
  uncertain?: string;
};

// The default cleanup is {}. keepBranch and discard widen it; Core re-validates a
// discard against the head and digest the user reviewed.
export type WorktreeCleanup = {
  keepBranch?: boolean;
  discard?: { expectHead: string; expectStatusDigest: string };
};

export type WorktreeCleanupResult = {
  action: "none" | "unbound" | "retained" | "removed";
  path?: string;
  branch?: string;
  directoryRemoved?: boolean;
  branchDeleted?: boolean;
  branchKept?: boolean;
  discarded?: boolean;
  commits?: string[];
  ignoredFiles?: string[];
};

export type SessionDependent = {
  sessionId: string;
  kind: string;
  reason: "running" | "owns_worktree" | "uncertain_worktree" | "independent";
};

export type WorktreeRefusalCode =
  | "dirty"
  | "unapplied"
  | "ignored"
  | "ownership"
  | "borrowed"
  | "stale"
  | "busy"
  | "runHeld"
  | "dependents";

export type WorktreeRefusal = {
  code: WorktreeRefusalCode;
  message: string;
  inspection?: WorktreeInspection;
  dependents?: SessionDependent[];
};

export type WorktreeCleanupOutcome = { result?: WorktreeCleanupResult; refusal?: WorktreeRefusal };

export type DeleteSessionOutcome = {
  result?: { sessionId: string; worktree: WorktreeCleanupResult; deletedChildren?: string[] };
  refusal?: WorktreeRefusal;
};

// Core runtime.SubagentNode. kind is the relation: "subagent" (read-only helper) or "execution"
// (an execution task in its own worktree, ADR-0006 D4). active: this process runs it.
export type SubagentNode = {
  sessionId: string;
  parentSessionId?: string;
  kind: "subagent" | "execution" | string;
  // The catalog agent the child pinned (ADR-0009 A3); absent before its first Start.
  agent?: string;
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

// The thread's start_task grant (ADR-0006 D4). Core stores it in the ui key and enforces the value
// passed at each Start; "none" is the default and is never stored.
export type Delegation = "none" | "propose" | "isolated";

export type SessionUIPatch = {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
  delegation?: Delegation;
};

// Core runtime.ExecutionTask: a task Core started.
export type ExecutionTask = {
  sessionId: string;
  parentSessionId: string;
  taskId?: string;
  base: string;
  runtime: SessionRuntime;
  status: string;
};

// Core taskstate.Task: a task the thread proposed or started.
export type ThreadTask = {
  id: string;
  objective: string;
  state: "proposed" | "started" | string;
  // The catalog agent the task runs (ADR-0009 A3); absent in tasks recorded before it.
  agent?: string;
  sessionId?: string;
  proposedAt?: string;
  startedAt?: string;
};

// Core runtime.TaskResult: the JSON of a task_result row, after its header line.
export type TaskResult = {
  taskId?: string;
  sessionId: string;
  agent?: string;
  objective: string;
  status: string;
  errorKind?: string;
  error?: string;
  final?: string;
  openUnits?: TaskResultUnit[];
  checks: TaskResultCheck[] | null;
  checksError?: string;
  handoff?: TaskHandoff;
  handoffError?: string;
};

export type TaskResultUnit = {
  id: string;
  goal: string;
  status: string;
};

export type TaskResultCheck = {
  id: string;
  required: boolean;
  satisfied: boolean;
  status: string;
  provenance?: string;
};

export type TaskHandoff = {
  branch: string;
  path: string;
  base?: string;
  head?: string;
  exists: boolean;
  dirtyFiles?: string[];
  dirtyCount: number;
  unappliedCommits: number;
};

export type Session = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  provider?: string;
  model?: string;
  modelRef?: string;
  // The catalog agent the session is pinned to (ADR-0009), empty before its first Start.
  agent?: string;
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



export type DiscoveredModel = {
  id: string;
};

export type ProviderConnectionResult = {
  ok: boolean;
  models: number;
  message: string;
};

export type ProviderPackage = "openai-compatible" | "anthropic-messages";

// Per-provider credential state from the backend. `ref` is the configured reference
// ({env:NAME} / {secret:NAME}) — never a secret value.
export type CredentialStatus = {
  providerId: string;
  scope: ProviderCatalogScope;
  source: "none" | "env" | "stored";
  ref?: string;
  set: boolean;
};

export type ProviderModel = {
  name?: string;
  modelID?: string;
  limit?: { context?: number; output?: number };
  // Set only when saving a rename: the key this model had in the file that was read.
  renamedFrom?: string;
};

export type ProviderDefinition = {
  name?: string;
  package?: ProviderPackage;
  settings?: {
    baseURL?: string;
    endpoint?: string;
    apiKey?: string;
  };
  models?: Record<string, ProviderModel>;
  // Set only when saving a rename: the id this provider had in the file that was read.
  renamedFrom?: string;
};

export type ProviderCatalog = {
  $schema?: string;
  model?: string;
  providers: Record<string, ProviderDefinition>;
};

export type ProviderCatalogScope = "global" | "workspace";

// One configuration file as the provider panel edits it. `digest` is the identity the file had
// when it was read; saving sends it back, and a changed file is rejected as a conflict.
export type ProviderCatalogDocument = {
  scope: ProviderCatalogScope;
  path: string;
  digest: string;
  catalog: ProviderCatalog;
};

// A catalog model as Core resolves it. It carries no credential and no header.
export type ModelInfo = {
  ref: string;
  providerName: string;
  modelName: string;
  modelID: string;
  context: number;
  output: number;
  toolCalling: boolean;
  inputModalities: string[];
  reasoningFormat: string;
  efforts?: string[];
  apiKeyEnv?: string;
  apiKeySet: boolean;
};

// Core's structured configuration warning; `message` is shown for a code this build does not know.
export type ConfigWarning = {
  code: string;
  path?: string;
  key?: string;
  moveTo?: string;
  trustEntry?: string;
  trustFile?: string;
  message: string;
};

export type ConfigState = {
  workspace: string;
  trusted: boolean;
  model: string;
  failover: string[];
  models: ModelInfo[];
  warnings: ConfigWarning[];
  globalPath: string;
  globalDigest: string;
  concurrency: ConcurrencyState;
};

// Core's global agent concurrency (ADR-0008), read at every run start.
export type AgentConcurrency = {
  maxAgents: number;
  maxChildrenPerParent: number;
};

// The effective limits with Core's defaults and schema bounds.
export type ConcurrencyState = {
  current: AgentConcurrency;
  default: AgentConcurrency;
  max: AgentConcurrency;
};

// A per-model reasoning level, or "auto" (Core classifies each turn and resolves one level; the
// heuristic applies when no effort.auto.model judge is configured).
export type AgentEffort = "none" | "low" | "medium" | "high" | "max" | "auto";

export type AgentConfig = {
  modelRef?: string;
  effort?: AgentEffort;
  policy?: "read-only" | "workspace" | "full";
  maxSteps?: number;
  maxToolCallsPerStep?: number;
  toolDenylist?: string[];
  maxTokens?: number;
  temperature?: number;
  delegation?: Delegation;
  // The Core catalog agent the turn runs (ADR-0009). Empty keeps the session's pinned agent. The
  // agent's instructions and ceilings are Core's: the composer names an agent, never its text.
  agent?: string;
};

export type AgentUse = "conversation" | "delegation" | "both";
export type AgentPolicy = "read-only" | "workspace" | "full";
export type AgentDelegation = "none" | "propose" | "isolated";
export type AgentSource = "builtin" | "global" | "workspace";

// One ordered model candidate: the agent's failover chain. `effort` is that candidate's own level.
export type AgentModelItem = {
  model: string;
  effort?: AgentEffort;
};

// One agent of Core's merged catalog. `models` null means the agent inherits a list. `source` is
// where the definition came from; a workspace definition is shown but edited in that file.
export type AgentEntry = {
  id: string;
  name: string;
  description?: string;
  use: AgentUse;
  policy: AgentPolicy;
  delegation: AgentDelegation;
  instructions: string;
  effort?: AgentEffort;
  models: AgentModelItem[] | null;
  builtin: boolean;
  source: AgentSource;
  digest: string;
  forConversation: boolean;
  editable: boolean;
};

// Core's catalog bounds, so the page explains a refusal while typing; Core validates again.
export type AgentLimits = {
  maxCustom: number;
  name: number;
  description: number;
  instructions: number;
  models: number;
  idPattern: string;
};

// What the one-time import of the retired Desktop agents.json did. Warnings name what was dropped
// (an unknown model, an over-limit entry), so nothing disappears silently.
export type AgentImportResult = {
  imported: boolean;
  alreadyImported: boolean;
  renamedTo?: string;
  custom: number;
  builtinOverrides: string[] | null;
  skipped: number;
  warnings: string[] | null;
};

export type AgentCatalog = {
  agents: AgentEntry[];
  limits: AgentLimits;
  globalPath: string;
  globalDigest: string;
  warning?: string;
  import?: AgentImportResult;
};

// Which files the one-click subagentModel migration rewrote.
export type SubagentModelMigration = {
  globalChanged: boolean;
  workspaceChanged: boolean;
};

// Task State (Core runtime.TaskStateInfo, ADR-0006). The host view already includes queued edits.
export type TaskReference = {
  id: string;
  kind: "path" | "thread" | string;
  target: string;
  note?: string;
  state: "included" | "excluded" | "suggested" | string;
  by: string;
  at: string;
};

// A note the agent (note_write) or the user wrote (ADR-0010 D1). Cites are workspace paths with the
// git blob they had when the note was written; the Task pane shows them as written.
export type TaskNote = {
  id: string;
  text: string;
  by: "agent" | "user" | string;
  cites?: { path: string; blob?: string }[];
  at: string;
};

// The user adds a note (no id), rewrites one (id + text) or removes one (id + remove).
export type TaskNoteEdit = { id?: string; text?: string; remove?: boolean };

export type TaskResolutionState = "open" | "done" | "dropped";

export type TaskResolution = {
  state: TaskResolutionState | string;
  by?: "user" | "evidence" | "reopen" | string;
  actor?: string;
  at?: string;
  refs?: string[];
  cancelledUnits?: string[];
};

export type TaskObligation = "work_units" | "gate" | "workflow" | "pending_application" | "checks" | "tasks" | string;

export type TaskStateInfo = {
  sessionId: string;
  version: number;
  pendingEdits: number;
  state: {
    brief?: string;
    references?: TaskReference[];
    // Newest last, as Core stores them.
    notes?: TaskNote[];
    resolution: TaskResolution;
    windowStartSeq: number;
    // The execution tasks the thread proposed or started, oldest first.
    tasks?: ThreadTask[];
  };
  obligations: TaskObligation[] | null;
  readyForReview: boolean;
  evidenceError?: string;
};

export type TaskReferenceEdit = {
  kind: "path" | "thread";
  target: string;
  note?: string;
  state: "included" | "excluded" | "removed";
};

// Checks (design §4.7, M4.1): configured checks, results with provenance "runtime" or "human:<id>",
// and content-addressed artifacts. Core decides; the UI shows its view.
export type CheckSpec = {
  id: string;
  kind: "test" | "build" | "schema" | string;
  command?: string;
  schema?: string;
  files?: string[];
  timeout: number; // nanoseconds
  required: boolean;
  source: "global" | "workspace" | string;
};

export type CheckResult = {
  seq?: number;
  workUnitId?: string;
  check: string;
  kind: string;
  status: "passed" | "failed" | "error" | string;
  provenance: string;
  fingerprint: string;
  artifacts: string[] | null;
  at: string;
};

export type CheckInfo = {
  spec: CheckSpec;
  satisfied: boolean;
  deciding?: CheckResult;
  newest?: CheckResult;
};

export type ChecksInfo = {
  sessionId: string;
  // head is "" outside git: no result is reused there and nothing can be accepted.
  env: { head: string; dirtyHash: string; worktreeId: string };
  checks: CheckInfo[] | null;
  warnings?: ConfigWarning[];
};

export type CheckArtifact = {
  hash: string;
  kind: "log" | "diff" | string;
  size: number;
  truncated: boolean;
  text: string;
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
