import { coreErrorKey } from "../lib/core-errors";

export type ErrorRecoveryKind = "provider" | "permissions" | "workspace" | "migrate";

const providerPatterns = [
  "provider",
  "model reference",
  "provider model",
  "model not found",
  "api key",
  "apikey",
  "secret",
  "{env:",
];

const permissionPatterns = [
  "permission",
  "permission denied",
  "read-only",
  "read only",
  "tool disabled",
  "tool is disabled",
  "not allowed",
  "policy",
];

const workspacePatterns = [
  "no workspace",
  "workspace is not open",
  "workspace unavailable",
  "runtime unavailable",
  "runtime is not available",
  "runtime offline",
  "wails bridge is not available",
];

export function errorRecoveryKind(error: string): ErrorRecoveryKind | null {
  const value = error.trim().toLowerCase();
  if (!value) return null;
  const core = coreErrorKey(error);
  // Opening again retries the migration once the other process released the database.
  if (core === "databaseInUse") return "workspace";
  // The retired key has a one-call repair; the toast offers it instead of a settings detour.
  if (core === "subagentModelRetired") return "migrate";
  if (core === "unknownModel" || core === "modelWithoutToolCalls" || core === "invalidConfig" || core === "conflict") return "provider";
  if (core) return null;
  if (providerPatterns.some((pattern) => value.includes(pattern))) return "provider";
  if (permissionPatterns.some((pattern) => value.includes(pattern))) return "permissions";
  if (workspacePatterns.some((pattern) => value.includes(pattern))) return "workspace";
  return null;
}
