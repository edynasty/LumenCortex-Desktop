export type WorkspaceRoute =
  | { kind: "new-task" }
  | { kind: "thread"; sessionId: string }
  | { kind: "providers" }
  | { kind: "review"; sessionId: string }
  | { kind: "extensions" };

export function routeSessionId(route: WorkspaceRoute): string {
  return route.kind === "thread" || route.kind === "review" ? route.sessionId : "";
}

export function isWorkspaceRoute(route: WorkspaceRoute): boolean {
  return route.kind !== "providers" && route.kind !== "extensions";
}
