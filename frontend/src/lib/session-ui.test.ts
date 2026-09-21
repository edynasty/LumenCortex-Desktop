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
    });
    expect(session.goal).toBe("Original goal");
  });
});
