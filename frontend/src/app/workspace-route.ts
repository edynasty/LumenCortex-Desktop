// Top-level pages of the global rail. Settings is a sheet over any page, not a route.
export type WorkspacePage = "threads" | "agents" | "scm" | "context" | "plugins";

export type WorkspaceRoute =
  | { kind: "new-task" }
  | { kind: "thread"; sessionId: string }
  // The thread's Changes view (toolbar segmented control), reviewing its runtime's diff.
  | { kind: "review"; sessionId: string }
  // Source Control: the project checkout ("main") or one session's worktree.
  | { kind: "scm"; checkout: "main" | string }
  | { kind: "context" }
  // The agent profile catalog: built-ins and the user's own agents.
  | { kind: "agents" }
  // Core's in-process plugins: what each one is, its entries and whether it rides in the rail.
  | { kind: "plugins" };

export function routeSessionId(route: WorkspaceRoute): string {
  return route.kind === "thread" || route.kind === "review" ? route.sessionId : "";
}

export function routePage(route: WorkspaceRoute): WorkspacePage {
  if (route.kind === "scm") return "scm";
  if (route.kind === "context") return "context";
  if (route.kind === "agents") return "agents";
  if (route.kind === "plugins") return "plugins";
  return "threads";
}
