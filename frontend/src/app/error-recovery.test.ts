import { describe, expect, it } from "vitest";
import { errorRecoveryKind } from "./error-recovery";

describe("errorRecoveryKind", () => {
  it("routes provider and secret failures to provider configuration", () => {
    expect(errorRecoveryKind("provider model not found")).toBe("provider");
    expect(errorRecoveryKind("OPENAI API key is missing")).toBe("provider");
  });

  it("routes permission failures to run permissions", () => {
    expect(errorRecoveryKind("permission denied for shell")).toBe("permissions");
    expect(errorRecoveryKind("tool is disabled by policy")).toBe("permissions");
  });

  it("routes workspace and runtime failures to project recovery", () => {
    expect(errorRecoveryKind("no workspace is open")).toBe("workspace");
    expect(errorRecoveryKind("runtime unavailable")).toBe("workspace");
  });

  it("leaves unknown errors without a misleading action", () => {
    expect(errorRecoveryKind("unexpected parse failure")).toBeNull();
    expect(errorRecoveryKind("")).toBeNull();
  });
});
