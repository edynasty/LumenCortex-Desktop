export type ErrorRecoveryKind = "provider" | "permissions" | "workspace";

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
  if (providerPatterns.some((pattern) => value.includes(pattern))) return "provider";
  if (permissionPatterns.some((pattern) => value.includes(pattern))) return "permissions";
  if (workspacePatterns.some((pattern) => value.includes(pattern))) return "workspace";
  return null;
}
