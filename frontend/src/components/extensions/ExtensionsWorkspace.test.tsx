import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExtensionsWorkspace } from "./ExtensionsWorkspace";

const mocks = vi.hoisted(() => ({
  mcpConfigsScope: vi.fn(),
  mcpStatuses: vi.fn(),
  mcpTools: vi.fn(),
  saveMCPConfigScope: vi.fn(),
  deleteMCPConfigScope: vi.fn(),
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
  enabled: "Enabled",
  disabled: "Disabled",
  globalScope: "Global",
  projectScope: "Project",
  globalScopeHint: "All projects",
  projectScopeHint: "Current project",
  inherited: "Inherited from global",
  globalSource: "Global",
  projectSource: "Project",
  mcpTab: "MCP",
  skillsTab: "Skills",
  skills: "Skills",
  skillAdd: "Add skill",
  skillEmpty: "No skills yet",
  skillGlobalHint: "All projects",
  skillProjectHint: "Current project",
  skillId: "Skill ID",
  skillContent: "SKILL.md content",
  skillDeleteTitle: "Delete skill?",
  skillDeleteBody: "Delete skill",
  skillError: "Skill error",
};

const globalConfig = {
  id: "helper",
  name: "Global Helper",
  command: "helper-server",
  args: [] as string[],
  protocolMode: "legacy" as const,
};

function configureScopes(options?: {
  global?: typeof globalConfig[];
  project?: typeof globalConfig[];
}) {
  const global = options?.global ?? [globalConfig];
  const project = options?.project ?? [];
  const projectById = new Map(project.map((item) => [item.id, item]));
  const effective = [
    ...global.filter((item) => !projectById.has(item.id)),
    ...project,
  ];
  mocks.mcpConfigsScope.mockImplementation(async (scope: string) => {
    if (scope === "global") return global;
    if (scope === "project") return project;
    return effective;
  });
}

function renderWorkspace(sessionId = "session-1") {
  return render(
    <ExtensionsWorkspace
      workspace="/repo"
      sessionId={sessionId}
      runtime={{ kind: "local", path: "/repo" }}
      labels={labels}
      onError={() => undefined}
    />
  );
}

describe("ExtensionsWorkspace", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    configureScopes();
    mocks.mcpStatuses.mockResolvedValue([]);
    mocks.mcpTools.mockResolvedValue([]);
    mocks.saveMCPConfigScope.mockResolvedValue(undefined);
    mocks.deleteMCPConfigScope.mockResolvedValue(undefined);
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
    renderWorkspace();

    expect(await screen.findByDisplayValue("helper-server")).toBeInTheDocument();
    expect(mocks.startMCP).not.toHaveBeenCalled();
    expect(screen.getByText("Inherited from global")).toBeInTheDocument();
  });

  it("starts the selected server only after explicit user action", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await screen.findByDisplayValue("helper-server");
    await user.click(screen.getByRole("button", { name: "Start server" }));

    await waitFor(() =>
      expect(mocks.startMCP).toHaveBeenCalledWith("session-1", "helper")
    );
  });

  it("saves edited server arguments through the project-scoped typed bridge", async () => {
    configureScopes({ global: [], project: [globalConfig] });
    const user = userEvent.setup();
    renderWorkspace("");

    await screen.findByDisplayValue("helper-server");
    const args = screen.getByLabelText("Arguments");
    await user.type(args, '--flag "two words"');
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.saveMCPConfigScope).toHaveBeenCalledWith(
        "project",
        expect.objectContaining({
          id: "helper",
          command: "helper-server",
          args: ["--flag", "two words"],
        })
      )
    );
  });

  it("shows a project override instead of the global config and falls back after deleting it", async () => {
    const projectOverride = {
      ...globalConfig,
      name: "Project Helper",
      command: "project-helper",
    };
    configureScopes({ global: [globalConfig], project: [projectOverride] });

    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByDisplayValue("project-helper")).toBeInTheDocument();
    expect(screen.getByText("Project Helper")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(mocks.deleteMCPConfigScope).toHaveBeenCalledWith("project", "helper")
    );
  });
});
