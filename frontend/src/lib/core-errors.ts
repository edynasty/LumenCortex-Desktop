import markers from "./core-errors.json";

export type CoreErrorKey = keyof typeof markers;

// Wails delivers Go errors as strings, so the UI matches the sentinel texts Core ships. The texts
// live in core-errors.json, which a Go test keeps equal to the sentinels of the pinned Core.
// Order matters: ErrInvalidConfig wraps other sentinels (an unknown model reference inside a
// file), so it is tested before them.
const order: CoreErrorKey[] = [
  "databaseInUse",
  "schemaTooNew",
  "legacyNodeDatabase",
  "invalidConfig",
  "conflict",
  "modelWithoutToolCalls",
  "invalidEffort",
  "unknownModel",
  "runHeld",
  "worktreeBusy",
];

export function coreErrorKey(error: string): CoreErrorKey | null {
  for (const key of order) {
    if (error.includes(markers[key])) return key;
  }
  return null;
}
