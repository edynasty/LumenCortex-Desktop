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
  pressure: boolean;
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

export type WorkspaceState = {
  workspace: string;
  health?: Health;
  sessions: Session[];
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

export type ProviderConfig = {
  endpoint?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  disableStreaming?: boolean;
  disableRetries?: boolean;
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

export type ShellResult = {
  command: string;
  exitCode: number;
  duration: number;
  stdout: { total: number; truncated: boolean };
  stderr: { total: number; truncated: boolean };
  cancelled: boolean;
};
