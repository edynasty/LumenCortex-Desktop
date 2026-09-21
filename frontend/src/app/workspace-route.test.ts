import { describe, expect, it } from "vitest";
import { isWorkspaceRoute, routeSessionId, type WorkspaceRoute } from "./workspace-route";

describe("workspace routes", () => {
  it("binds session ids only to session routes", () => {
    expect(routeSessionId({ kind: "new-task" })).toBe("");
    expect(routeSessionId({ kind: "providers" })).toBe("");
    expect(routeSessionId({ kind: "thread", sessionId: "s1" })).toBe("s1");
    expect(routeSessionId({ kind: "review", sessionId: "s2" })).toBe("s2");
  });

  it("classifies primary workspace routes", () => {
    const routes: WorkspaceRoute[] = [
      { kind: "new-task" },
      { kind: "thread", sessionId: "s1" },
      { kind: "review", sessionId: "s1" },
      { kind: "providers" },
      { kind: "extensions" },
    ];
    expect(routes.map(isWorkspaceRoute)).toEqual([true, true, true, false, false]);
  });
});
