import type { Message } from "../../types";

export type CheckResult = {
  seq: number;
  command: string;
  ok: boolean;
  exitCode?: number;
  truncated: boolean;
};

const checkPattern = /(?:^|\s)(?:go\s+test|go\s+vet|go\s+build|npm\s+test|npm\s+run\s+build|pnpm\s+test|yarn\s+test|pytest|cargo\s+test|cargo\s+check|tsc|eslint|lint|test|build|check|vet)(?:\s|$)/i;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function extractCheckResults(messages: Message[], limit = 6): CheckResult[] {
  const results: CheckResult[] = [];
  for (const message of messages) {
    if (message.role !== "tool") continue;
    const payload = record(message.json);
    if (!payload || payload.name !== "shell" || typeof payload.content !== "string") continue;

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(payload.content) as Record<string, unknown>;
    } catch {
      continue;
    }
    const command = typeof result.command === "string" ? result.command.trim() : "";
    if (!command || !checkPattern.test(command)) continue;

    const exitCode = typeof result.exitCode === "number" ? result.exitCode : undefined;
    const stdout = record(result.stdout);
    const stderr = record(result.stderr);
    results.push({
      seq: message.seq,
      command,
      ok: exitCode === 0 && result.cancelled !== true,
      exitCode,
      truncated: result.truncated === true || stdout?.truncated === true || stderr?.truncated === true,
    });
  }
  return results.slice(-Math.max(1, limit));
}
