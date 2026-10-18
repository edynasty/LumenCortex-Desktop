// Top-level pages of the global rail. Settings is a sheet over any page, not a route.
export type WorkspacePage = "threads" | "scm" | "context";

export type WorkspaceRoute =
  | { kind: "new-task" }
  | { kind: "thread"; sessionId: string }
  // The thread's Changes view (toolbar segmented control), reviewing its runtime's diff.
  | { kind: "review"; sessionId: string }
  // Source Control: the project checkout ("main") or one session's worktree.
  | { kind: "scm"; checkout: "main" | string }
  | { kind: "context" };

export function routeSessionId(route: WorkspaceRoute): string {
  return route.kind === "thread" || route.kind === "review" ? route.sessionId : "";
}

export function routePage(route: WorkspaceRoute): WorkspacePage {
  return route.kind === "scm" ? "scm" : route.kind === "context" ? "context" : "threads";
}
