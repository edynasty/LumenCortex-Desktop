import { describe, expect, it } from "vitest";
import { presentError } from "./error-presentation";
import { copy } from "./i18n/app-copy";
import { errorRecoveryKind } from "../app/error-recovery";

const cases: Array<[string, string, keyof typeof copy.en]> = [
  ["Error: database is open in another process; close it to change the schema: /repo/.lumencortex", "databaseInUse", "errDatabaseInUse"],
  ["Error: database schema is newer than this binary: have user_version 9, binary knows 2", "schemaTooNew", "errSchemaTooNew"],
  ["Error: database was created by the legacy Node runtime and is not supported: /repo has Node tables", "legacyNodeDatabase", "errLegacyNodeDatabase"],
  ["Error: model is not in the provider catalog: nope/x", "unknownModel", "errUnknownModel"],
  ["Error: model does not support tool calling: test/chat", "modelWithoutToolCalls", "errModelWithoutToolCalling"],
  ["Error: effort must be one of none, low, medium, high, max", "invalidEffort", "errInvalidEffort"],
  ["Error: config file changed since it was read: /home/lumencortex.json", "conflict", "errConflict"],
  ["Error: run is active in another process or engine", "runHeld", "runningElsewhereError"],
  ["Error: session worktree is in use: /repo/.lumencortex-worktrees/session_1 (wt_session_1)", "worktreeBusy", "errWorktreeBusy"],
];

describe("Core error presentation", () => {
  it.each(["zh-CN", "en"] as const)("explains every Core sentinel in %s", (locale) => {
    for (const [raw, , key] of cases) {
      expect(presentError(copy[locale], raw), raw).toBe(copy[locale][key]);
    }
  });

  it("keeps Core's detail for an invalid configuration, because it names the entry to fix", () => {
    const raw = "Error: invalid configuration: /home/lumencortex.json: model \"a/b\" is not defined";
    expect(presentError(copy.en, raw)).toBe(copy.en.errInvalidConfig + "/home/lumencortex.json: model \"a/b\" is not defined");
  });

  it("does not take an unknown model inside an invalid file for the picker error", () => {
    const raw = "Error: invalid configuration: model: model is not in the provider catalog";
    expect(presentError(copy.en, raw).startsWith(copy.en.errInvalidConfig)).toBe(true);
  });

  it("leaves any other error as Core wrote it", () => {
    expect(presentError(copy.en, "Error: something new")).toBe("Error: something new");
  });

  it("offers recovery that matches the problem", () => {
    expect(errorRecoveryKind(cases[0][0])).toBe("workspace");
    expect(errorRecoveryKind(cases[1][0])).toBeNull();
    expect(errorRecoveryKind(cases[2][0])).toBeNull();
    expect(errorRecoveryKind(cases[3][0])).toBe("provider");
    expect(errorRecoveryKind(cases[4][0])).toBe("provider");
    expect(errorRecoveryKind(cases[6][0])).toBe("provider");
    expect(errorRecoveryKind(cases[7][0])).toBeNull();
  });
});
