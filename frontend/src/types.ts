export type Budget = {
  softBytes: number;
  hardBytes: number;
  maxAgents: number;
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

export type ShellResult = {
  command: string;
  exitCode: number;
  duration: number;
  stdout: { total: number; truncated: boolean };
  stderr: { total: number; truncated: boolean };
  cancelled: boolean;
};
