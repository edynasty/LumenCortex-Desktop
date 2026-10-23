import { describe, expect, it } from "vitest";
import { routePage, routeSessionId, type WorkspaceRoute } from "./workspace-route";

describe("workspace routes", () => {
  it("binds the loaded session only to thread routes", () => {
    expect(routeSessionId({ kind: "new-task" })).toBe("");
    expect(routeSessionId({ kind: "thread", sessionId: "s1" })).toBe("s1");
    expect(routeSessionId({ kind: "review", sessionId: "s2" })).toBe("s2");
    // A worktree selected in Source Control does not load that session's transcript.
    expect(routeSessionId({ kind: "scm", checkout: "s3" })).toBe("");
    expect(routeSessionId({ kind: "context" })).toBe("");
    expect(routeSessionId({ kind: "plugins" })).toBe("");
  });

  it("maps every route to its rail page", () => {
    const routes: WorkspaceRoute[] = [
      { kind: "new-task" },
      { kind: "thread", sessionId: "s1" },
      { kind: "review", sessionId: "s1" },
      { kind: "scm", checkout: "main" },
      { kind: "context" },
      { kind: "agents" },
      { kind: "plugins" },
    ];
    expect(routes.map(routePage)).toEqual(["threads", "threads", "threads", "scm", "context", "agents", "plugins"]);
  });
});
