import { describe, expect, it } from "vitest";
import type { Message } from "../../types";
import { extractCheckResults } from "./checks";

function tool(seq: number, command: string, exitCode: number, truncated = false): Message {
  return {
    sessionId: "s1",
    seq,
    role: "tool",
    json: {
      role: "tool",
      name: "shell",
      content: JSON.stringify({
        command,
        exitCode,
        cancelled: false,
        stdout: { truncated },
        stderr: { truncated: false },
      }),
    },
  };
}

describe("review check extraction", () => {
  it("keeps recent test/build/check commands and their result", () => {
    const results = extractCheckResults([
      tool(1, "git status --short", 0),
      tool(2, "go test ./...", 0),
      tool(3, "npm run build", 1, true),
    ]);
    expect(results).toEqual([
      { seq: 2, command: "go test ./...", ok: true, exitCode: 0, truncated: false },
      { seq: 3, command: "npm run build", ok: false, exitCode: 1, truncated: true },
    ]);
  });

  it("bounds the retained check summary", () => {
    const messages = Array.from({ length: 10 }, (_, index) => tool(index, "go test ./...", 0));
    const results = extractCheckResults(messages, 3);
    expect(results.map((item) => item.seq)).toEqual([7, 8, 9]);
  });
});
