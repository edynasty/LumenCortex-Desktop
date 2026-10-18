import { describe, expect, it } from "vitest";
import type { Session } from "../types";
import { sessionUI } from "./session-ui";

const base: Session = {
  id: "s1",
  createdAt: "",
  updatedAt: "",
  status: "completed",
  goal: "Original goal",
};

describe("sessionUI", () => {
  it("falls back to the durable goal when UI metadata is absent", () => {
    expect(sessionUI(base)).toEqual({
      title: "Original goal",
      pinned: false,
      archived: false,
      delegation: "none",
      parentSessionId: undefined,
      childMode: undefined,
    });
  });

  it("reads title, pinned and archived metadata without changing the goal", () => {
    const session: Session = {
      ...base,
      metadata: {
        contextPaths: ["src/main.go"],
        ui: {
          title: "Readable title",
          pinned: true,
          archived: true,
        },
      },
    };
    expect(sessionUI(session)).toEqual({
      title: "Readable title",
      pinned: true,
      archived: true,
      delegation: "none",
      parentSessionId: undefined,
      childMode: undefined,
    });
    expect(session.goal).toBe("Original goal");
  });

  it("identifies durable subagent parent metadata", () => {
    const session: Session = {
      ...base,
      metadata: {
        subagent: {
          parentSessionId: "parent-session",
          mode: "read-only",
        },
      },
    };
    expect(sessionUI(session).parentSessionId).toBe("parent-session");
    expect(sessionUI(session).childMode).toBe("read-only");
  });

  it("reads the thread's delegation grant; an unknown value is none", () => {
    const withGrant = (delegation: unknown): Session => ({ ...base, metadata: { ui: { delegation } } });
    expect(sessionUI(withGrant("propose")).delegation).toBe("propose");
    expect(sessionUI(withGrant("isolated")).delegation).toBe("isolated");
    expect(sessionUI(withGrant("full")).delegation).toBe("none");
  });

  it("never reports a grant for a child, whatever its ui key holds", () => {
    const child: Session = {
      ...base,
      metadata: {
        ui: { delegation: "isolated" },
        subagent: { parentSessionId: "parent", mode: "execution" },
      },
    };
    expect(sessionUI(child).delegation).toBe("none");
    expect(sessionUI(child).childMode).toBe("execution");
  });
});
