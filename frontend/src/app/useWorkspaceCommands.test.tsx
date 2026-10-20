import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../lib/i18n/app-copy";
import { useWorkspaceCommands } from "./useWorkspaceCommands";

const t = copy.en;

const retired =
  'Error: invalid configuration: /home/lumencortex.json: subagentModel is retired: set "agents": {"explore": {"models": [{"model": "<ref>"}]}, "worker": {"models": [{"model": "<ref>"}]}} instead';

function setup(error: string) {
  const onMigrateSubagentModel = vi.fn();
  const onOpenWorkspace = vi.fn();
  const onPickWorkspace = vi.fn();
  const onClearError = vi.fn();
  const { result } = renderHook(() => useWorkspaceCommands({
    route: { kind: "new-task" },
    selectedSessionId: "",
    sessionIds: new Set<string>(),
    workspace: "/repo",
    locale: "en",
    labels: t,
    settings: { open: false, pane: "general", mounted: false },
    paletteOpen: false,
    onSetRoute: vi.fn(),
    onSettingsChange: vi.fn(),
    onPaletteOpenChange: vi.fn(),
    onNewTask: vi.fn(),
    onPickWorkspace,
    onLocaleChange: vi.fn(),
    onThemePreferenceChange: vi.fn(),
    error,
    onClearError,
    onOpenWorkspace,
    onMigrateSubagentModel,
    onInspectorTabChange: vi.fn(),
    onInspectorOpenChange: vi.fn(),
  }));
  return { result, onMigrateSubagentModel, onOpenWorkspace, onPickWorkspace, onClearError };
}

describe("the subagentModel migration prompt", () => {
  it("offers the one-click migration and calls the bridge repair", () => {
    const { result, onMigrateSubagentModel, onOpenWorkspace, onClearError } = setup(retired);
    expect(result.current.recovery?.label).toBe(t.subagentModelMigrate);
    result.current.recovery?.run();
    expect(onClearError).toHaveBeenCalledTimes(1);
    expect(onMigrateSubagentModel).toHaveBeenCalledTimes(1);
    // Migrating is not a workspace reopen.
    expect(onOpenWorkspace).not.toHaveBeenCalled();
  });

  it("offers no migrate action for any other configuration error", () => {
    const { result } = setup("Error: invalid configuration: /home/lumencortex.json: model \"a/b\" is not defined");
    expect(result.current.recovery?.label).toBe(t.providerConfig);
  });
});
