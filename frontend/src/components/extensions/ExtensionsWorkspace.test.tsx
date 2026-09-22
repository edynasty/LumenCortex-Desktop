import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExtensionsWorkspace } from "./ExtensionsWorkspace";

const mocks = vi.hoisted(() => ({
  mcpConfigs: vi.fn(),
  mcpStatuses: vi.fn(),
  mcpTools: vi.fn(),
  saveMCPConfig: vi.fn(),
  deleteMCPConfig: vi.fn(),
  startMCP: vi.fn(),
  stopMCP: vi.fn(),
  refreshMCPTools: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

const labels = {
  title: "Extensions",
  subtitle: "Manage extensions",
  mcpServers: "MCP Servers",
  addServer: "Add server",
  noServers: "No MCP servers yet",
  serverId: "Server ID",
  serverName: "Name",
  command: "Command",
  args: "Arguments",
  protocol: "Protocol",
  legacy: "Legacy",
  modern: "Modern",
  save: "Save",
  delete: "Delete",
  deleteTitle: "Delete server?",
  deleteBody: "Delete it",
  cancel: "Cancel",
  start: "Start server",
  stop: "Stop server",
  refresh: "Refresh",
  running: "Running",
  stopped: "Stopped",
  pid: "PID",
  pending: "Pending",
  tools: "Tools",
  noTools: "No tools",
  readOnly: "Read only",
  sideEffect: "May have side effects",
  noAutoStart: "Saved only",
  currentRuntime: "Current runtime",
  localRuntime: "Local",
  worktreeRuntime: "Worktree",
  lastError: "Last error",
  selectServer: "Select server",
};

describe("ExtensionsWorkspace", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.mcpConfigs.mockResolvedValue([
      { id: "helper", name: "Helper", command: "helper-server", args: [], protocolMode: "legacy" },
    ]);
    mocks.mcpStatuses.mockResolvedValue([]);
    mocks.mcpTools.mockResolvedValue([]);
    mocks.saveMCPConfig.mockResolvedValue(undefined);
    mocks.deleteMCPConfig.mockResolvedValue(undefined);
    mocks.startMCP.mockResolvedValue({
      id: "helper",
      running: true,
      protocolMode: "legacy",
      pendingRequests: 0,
      tools: 1,
    });
    mocks.stopMCP.mockResolvedValue(undefined);
    mocks.refreshMCPTools.mockResolvedValue(undefined);
  });

  it("loads saved configuration without auto-starting a server", async () => {
    render(
      <ExtensionsWorkspace
        workspace="/repo"
        sessionId="session-1"
        runtime={{ kind: "local", path: "/repo" }}
        labels={labels}
        onError={() => undefined}
      />
    );

    expect(await screen.findByDisplayValue("helper-server")).toBeInTheDocument();
    expect(mocks.startMCP).not.toHaveBeenCalled();
    expect(screen.getByText("Saved only")).toBeInTheDocument();
  });

  it("starts the selected server only after explicit user action", async () => {
    const user = userEvent.setup();
    render(
      <ExtensionsWorkspace
        workspace="/repo"
        sessionId="session-1"
        runtime={{ kind: "local", path: "/repo" }}
        labels={labels}
        onError={() => undefined}
      />
    );

    await screen.findByDisplayValue("helper-server");
    await user.click(screen.getByRole("button", { name: "Start server" }));

    await waitFor(() =>
      expect(mocks.startMCP).toHaveBeenCalledWith("session-1", "helper")
    );
  });

  it("saves edited server arguments through the typed bridge", async () => {
    const user = userEvent.setup();
    render(
      <ExtensionsWorkspace
        workspace="/repo"
        sessionId=""
        runtime={{ kind: "local", path: "/repo" }}
        labels={labels}
        onError={() => undefined}
      />
    );

    await screen.findByDisplayValue("helper-server");
    const args = screen.getByLabelText("Arguments");
    await user.type(args, '--flag "two words"');
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.saveMCPConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "helper",
          command: "helper-server",
          args: ["--flag", "two words"],
        })
      )
    );
  });
});
