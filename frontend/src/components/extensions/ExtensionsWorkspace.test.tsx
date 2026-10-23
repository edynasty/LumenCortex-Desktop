import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MCPConfig } from "../../types";
import { ExtensionsWorkspace, type ExtensionsTab } from "./ExtensionsWorkspace";

const mocks = vi.hoisted(() => ({
  mcpConfigsScope: vi.fn(),
  mcpStatuses: vi.fn(),
  mcpTools: vi.fn(),
  saveMCPConfigScope: vi.fn(),
  deleteMCPConfigScope: vi.fn(),
  startMCP: vi.fn(),
  stopMCP: vi.fn(),
  refreshMCPTools: vi.fn(),
  toolPermissions: vi.fn(),
  saveToolPermissions: vi.fn(),
  skills: vi.fn(),
  skillContent: vi.fn(),
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
  trustRequired: "Workspace not trusted - not loaded",
  trustWorkspace: "Trust this workspace",
  trustingWorkspace: "Trusting…",
  toolOverrides: "Tool permission overrides",
  overrideInactive: "The workspace is not trusted, so Core does not apply this project's tool permission overrides.",
  permissionRead: "Read only",
  permissionWrite: "Write",
  permissionExec: "Exec",
  permissionFromAnnotation: "Server annotation",
  permissionFromOverride: "User override",
  markReadOnly: "Mark read-only",
  clearOverride: "Clear override",
  mcpTab: "MCP",
  skillsTab: "Skills",
  permissionsTab: "Permissions",
  permissions: "Tool permissions",
  permissionsDescription: "Manage tool access",
  permissionsBuiltIn: "Built-in tools",
  permissionsLanguage: "Language services",
  permissionsSubagents: "Subagents",
  permissionsMCP: "MCP tools",
  permissionsOther: "Other",
  permissionsEmpty: "No tools",
  skills: "Skills",
  skillAdd: "Add skill",
  skillEmpty: "No skills yet",
  skillGlobalHint: "All projects",
  skillProjectHint: "Current project",
  skillEffectiveScope: "Effective",
  skillEffectiveHint: "What a run sees",
  skillNotLoaded: "Not loaded (workspace not trusted)",
  skillId: "Skill ID",
  skillContent: "SKILL.md content",
  skillSaveAsCopy: "Save as LumenCortex copy",
  skillSaveAsCopyTitle: "Save as a LumenCortex copy?",
  skillSaveAsCopyBody: "It shadows the original.",
  skillDeleteTitle: "Delete skill?",
  skillDeleteBody: "Delete skill",
  skillError: "Skill error",
  skillLinked: "Link",
  skillReadOnly: "Read-only",
  skillShadowedBy: "Shadowed by",
  skillOverridesGlobal: "Overrides global",
  skillPath: "Path",
  skillRoot: "Root",
  skillRealPath: "Real path",
  skillReadOnlyNote: "LumenCortex never modifies this skill.",
  skillReachable: "enabled skills reach runs",
  skillCatalogHint: "Runs get a catalog and load the full skill on demand.",
  skillSelect: "Select a skill to see its details",
};

const globalConfig: MCPConfig = {
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

function renderWorkspace(
  sessionId = "session-1",
  tab: ExtensionsTab = "mcp",
  options?: { trusted?: boolean; onTrust?: () => void; onError?: (message: string) => void },
) {
  return render(
    <ExtensionsWorkspace
      tab={tab}
      workspace="/repo"
      sessionId={sessionId}
      runtime={{ kind: "local", path: "/repo" }}
      trusted={options?.trusted ?? true}
      trusting={false}
      onTrust={options?.onTrust ?? (() => undefined)}
      labels={labels}
      onError={options?.onError ?? (() => undefined)}
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
    mocks.toolPermissions.mockResolvedValue({ disabled: [] });
    mocks.saveToolPermissions.mockImplementation(async (value) => value);
    mocks.skills.mockResolvedValue([]);
    mocks.skillContent.mockResolvedValue("");
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

  it("persists disabled tool permissions from the permissions tab", async () => {
    const user = userEvent.setup();
    renderWorkspace("session-1", "permissions");

    const shellRow = await screen.findByRole("switch", { name: /shell/i });
    await user.click(shellRow);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.saveToolPermissions).toHaveBeenCalledWith(
        expect.objectContaining({ disabled: expect.arrayContaining(["shell"]) })
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
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(mocks.deleteMCPConfigScope).toHaveBeenCalledWith("project", "helper")
    );
  });

  it("shows a blocked project server, disables Start and offers to trust the workspace", async () => {
    const projectServer = { ...globalConfig, blockedByTrust: true };
    configureScopes({ global: [], project: [projectServer] });
    const onTrust = vi.fn();
    const user = userEvent.setup();
    renderWorkspace("session-1", "mcp", { trusted: false, onTrust });

    expect(await screen.findByDisplayValue("helper-server")).toBeInTheDocument();
    // The row and the runtime section both say why, in the same words.
    expect(screen.getAllByText("Workspace not trusted - not loaded").length).toBeGreaterThan(0);

    const start = screen.getByRole("button", { name: "Start server" });
    expect(start).toBeDisabled();
    expect(start).toHaveAttribute("title", "Workspace not trusted - not loaded");

    await user.click(screen.getByRole("button", { name: "Trust this workspace" }));
    expect(onTrust).toHaveBeenCalledTimes(1);
    expect(mocks.startMCP).not.toHaveBeenCalled();
  });

  it("turns a start refused for trust into the trust notice instead of a raw error", async () => {
    configureScopes({ global: [], project: [{ ...globalConfig }] });
    mocks.startMCP.mockRejectedValue(
      new Error("mcp server is defined by the project configuration of an untrusted workspace: helper"),
    );
    const onError = vi.fn();
    const user = userEvent.setup();
    renderWorkspace("session-1", "mcp", { trusted: true, onError });

    await screen.findByDisplayValue("helper-server");
    await user.click(screen.getByRole("button", { name: "Start server" }));

    expect(await screen.findByText("Workspace not trusted - not loaded")).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  it("writes a read-only tool override into the file the server entry came from", async () => {
    configureScopes({ global: [], project: [{ ...globalConfig }] });
    mocks.mcpTools.mockResolvedValue([
      {
        name: "mcp__helper__write_file",
        serverId: "helper",
        toolName: "write_file",
        inputSchema: { type: "object" },
        readOnly: false,
        permission: "exec",
        permissionSource: "annotation",
        scope: "project",
      },
    ]);
    const user = userEvent.setup();
    renderWorkspace();

    await screen.findByDisplayValue("helper-server");
    expect(await screen.findByText("Exec")).toBeInTheDocument();
    expect(screen.getByText("Server annotation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark read-only" }));

    await waitFor(() =>
      expect(mocks.saveMCPConfigScope).toHaveBeenCalledWith(
        "project",
        expect.objectContaining({
          id: "helper",
          command: "helper-server",
          tools: { write_file: { permission: "read" } },
        }),
      )
    );
  });

  it("clears an override through the same save path", async () => {
    configureScopes({
      global: [],
      project: [{ ...globalConfig, tools: { write_file: { permission: "read" as const } } }],
    });
    mocks.mcpTools.mockResolvedValue([
      {
        name: "mcp__helper__write_file",
        serverId: "helper",
        toolName: "write_file",
        inputSchema: { type: "object" },
        readOnly: true,
        permission: "read",
        permissionSource: "override",
        scope: "project",
      },
    ]);
    const user = userEvent.setup();
    renderWorkspace();

    await screen.findByDisplayValue("helper-server");
    expect(await screen.findByText("User override")).toBeInTheDocument();

    const clear = screen.getAllByRole("button", { name: "Clear override" });
    await user.click(clear[clear.length - 1]);

    await waitFor(() => {
      const [, payload] = mocks.saveMCPConfigScope.mock.calls.at(-1)!;
      expect(payload.id).toBe("helper");
      expect(payload.tools).toBeUndefined();
    });
  });

  it("says a project override has no effect while the workspace is untrusted", async () => {
    configureScopes({
      global: [],
      project: [{ ...globalConfig, blockedByTrust: true, tools: { write_file: { permission: "read" as const } } }],
    });
    renderWorkspace("session-1", "mcp", { trusted: false });

    expect(await screen.findByDisplayValue("helper-server")).toBeInTheDocument();
    expect(screen.getByText("Tool permission overrides")).toBeInTheDocument();
    expect(
      screen.getByText("The workspace is not trusted, so Core does not apply this project's tool permission overrides."),
    ).toBeInTheDocument();
  });

  it("shows a shadowed entry as global, because Core resolved the project file away", async () => {
    // Untrusted workspace: Core ignores the project file, so the effective listing is the global
    // entry. The row must not claim the project layer.
    mocks.mcpConfigsScope.mockImplementation(async (scope: string) => {
      if (scope === "global") return [{ ...globalConfig, scope: "global" as const }];
      if (scope === "project") {
        return [{ ...globalConfig, name: "Project Helper", command: "project-helper", scope: "project" as const }];
      }
      return [{ ...globalConfig, scope: "global" as const }];
    });
    renderWorkspace("session-1", "mcp", { trusted: false });

    const row = await screen.findByRole("button", { name: /Global Helper/ });
    expect(row).toHaveTextContent(/· Global ·/);
    expect(row).not.toHaveTextContent("Project");
  });

  it("marks project skills as not loaded while the workspace is untrusted", async () => {
    const projectSkill = {
      id: "go-backend",
      name: "Go Backend",
      scope: "project" as const,
      source: "lumencortex" as const,
      root: "/repo/.lumencortex/skills",
      path: "/repo/.lumencortex/skills/go-backend/SKILL.md",
      enabled: true,
    };
    mocks.skills.mockImplementation(async (scope: string) => (scope === "global" ? [] : [projectSkill]));
    mocks.skillContent.mockResolvedValue("---\nname: Go Backend\n---\n");
    renderWorkspace("session-1", "skills", { trusted: false });

    expect(await screen.findByText("Go Backend")).toBeInTheDocument();
    expect(screen.getAllByText("Not loaded (workspace not trusted)").length).toBeGreaterThan(0);
  });
});
