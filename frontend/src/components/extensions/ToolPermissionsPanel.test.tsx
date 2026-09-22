import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolPermissionsPanel } from "./ToolPermissionsPanel";

const mocks = vi.hoisted(() => ({
  toolPermissions: vi.fn(),
  saveToolPermissions: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

const labels = {
  title: "Tool permissions",
  description: "Control tools",
  builtIn: "Built-in",
  language: "Language",
  subagents: "Subagents",
  mcp: "MCP",
  other: "Other",
  enabled: "Enabled",
  disabled: "Disabled",
  save: "Save",
  empty: "No tools",
};

describe("ToolPermissionsPanel", () => {
  beforeEach(() => {
    mocks.toolPermissions.mockReset();
    mocks.saveToolPermissions.mockReset();
    mocks.toolPermissions.mockResolvedValue({ disabled: [] });
    mocks.saveToolPermissions.mockImplementation(async (value) => value);
  });

  it("persists a disabled built-in tool through the typed bridge", async () => {
    const user = userEvent.setup();
    render(
      <ToolPermissionsPanel
        workspace="/repo"
        mcpTools={[]}
        labels={labels}
        onError={() => undefined}
      />
    );

    const shell = await screen.findByRole("button", { name: /shell/i });
    expect(shell).toHaveAttribute("aria-pressed", "true");

    await user.click(shell);
    expect(shell).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.saveToolPermissions).toHaveBeenCalledWith({
        disabled: ["shell"],
      });
    });
  });

  it("keeps previously disabled unknown tools visible for recovery", async () => {
    mocks.toolPermissions.mockResolvedValue({ disabled: ["mcp__old__removed"] });

    render(
      <ToolPermissionsPanel
        workspace="/repo"
        mcpTools={[]}
        labels={labels}
        onError={() => undefined}
      />
    );

    const unknown = await screen.findByRole("button", { name: /mcp__old__removed/i });
    expect(unknown).toHaveAttribute("aria-pressed", "false");
  });
});
