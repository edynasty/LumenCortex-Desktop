import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { AgentCatalog, AgentEntry } from "../../types";
import type { AgentCatalogController } from "../../app/hooks/useAgentCatalog";
import { AgentsPage } from "./AgentsPage";

const t = copy.en;

function entry(overrides: Partial<AgentEntry> & { id: string }): AgentEntry {
  return {
    name: overrides.id, description: "", use: "conversation", policy: "full", delegation: "isolated",
    instructions: "", models: null, builtin: false, source: "global", digest: `sha256:${overrides.id}`,
    forConversation: true, editable: true, ...overrides,
  };
}

const builtins = [
  entry({
    id: "ask", name: "Ask", description: "Answers questions.", policy: "read-only", delegation: "none",
    builtin: true, source: "builtin",
  }),
  entry({ id: "agent", name: "Agent", description: "Works on the task.", builtin: true, source: "builtin" }),
  entry({ id: "explore", name: "Explore", use: "delegation", forConversation: false, builtin: true, source: "builtin" }),
  entry({ id: "worker", name: "Worker", use: "delegation", forConversation: false, builtin: true, source: "builtin" }),
];

const reviewer = entry({
  id: "reviewer", name: "Code reviewer", description: "Reads diffs.",
  policy: "read-only", delegation: "none", instructions: "Lead with the risk.",
  models: [{ model: "openai/gpt-5.6", effort: "high" }],
});

const catalog = (agents: AgentEntry[]): AgentCatalog => ({
  agents,
  limits: { maxCustom: 16, name: 40, description: 280, instructions: 16 << 10, models: 8, idPattern: "^[a-z][a-z0-9-]{0,39}$" },
  globalPath: "/home/lumencortex.json",
  globalDigest: "sha256:g",
});

function controller(agents: AgentEntry[], overrides: Partial<AgentCatalogController> = {}): AgentCatalogController {
  return {
    agents,
    limits: catalog(agents).limits,
    loading: false,
    agentId: "agent",
    select: vi.fn(),
    composerAgent: { agents, selectedId: "agent", onSelect: vi.fn() },
    save: vi.fn(async (agent: AgentEntry) => catalog([...agents.filter((item) => item.id !== agent.id), agent])),
    remove: vi.fn(async () => catalog(agents)),
    presets: vi.fn(async () => []),
    reload: vi.fn(async () => catalog(agents)),
    ...overrides,
  };
}

const models = [
  { value: "openai/gpt-5.6", label: "GPT-5.6" },
  { value: "openai/gpt-5.6-mini", label: "GPT-5.6 mini" },
];

function renderPage(
  agents: AgentEntry[],
  overrides: Partial<AgentCatalogController> = {},
  modelOptions: ComponentProps<typeof AgentsPage>["models"] = models,
) {
  const agentsController = controller(agents, overrides);
  render(
    <AgentsPage
      labels={t}
      agents={agentsController}
      models={modelOptions}
      recentModelRefs={[]}
      effortOptions={["low", "medium", "high"]}
      onOpenProviders={vi.fn()}
    />,
  );
  return agentsController;
}

describe("AgentsPage", () => {
  it("lists the four built-ins with a badge and a custom agent", () => {
    renderPage([...builtins, reviewer]);
    const list = screen.getByRole("list", { name: t.agentsSelectHint });
    expect(within(list).getByText(t.agentAskName)).toBeInTheDocument();
    expect(within(list).getByText(t.agentAgentName)).toBeInTheDocument();
    expect(within(list).getByText(t.agentExploreName)).toBeInTheDocument();
    expect(within(list).getByText(t.agentWorkerName)).toBeInTheDocument();
    expect(within(list).getByText("Code reviewer")).toBeInTheDocument();
    expect(within(list).getAllByText(t.agentsBuiltin)).toHaveLength(4);
  });

  it("shows a built-in's fixed fields read-only and cannot delete it", async () => {
    const user = userEvent.setup();
    renderPage([...builtins, reviewer]);
    await user.click(screen.getByRole("button", { name: new RegExp(`^${t.agentAskName}`) }));

    const editor = screen.getByRole("region", { name: t.agentAskName });
    expect(within(editor).getByDisplayValue(t.agentAskName)).toBeDisabled();
    expect(within(editor).getByDisplayValue("Answers questions.")).toBeDisabled();
    expect(within(editor).queryByRole("button", { name: t.agentsDelete })).toBeNull();
    expect(within(editor).getByRole("button", { name: t.agentsReset })).toBeInTheDocument();
  });

  it("edits a custom agent's instructions and saves it", async () => {
    const user = userEvent.setup();
    const agentsController = renderPage([...builtins, reviewer]);
    await user.click(screen.getByRole("button", { name: /Code reviewer/ }));

    const editor = screen.getByRole("region", { name: "Code reviewer" });
    const instructions = within(editor).getByRole("textbox", { name: new RegExp(t.agentsInstructions) });
    await user.clear(instructions);
    await user.type(instructions, "Name the regression first.");
    expect(within(editor).getByText(t.agentsUnsaved)).toBeInTheDocument();

    await user.click(within(editor).getByRole("button", { name: t.agentsSave }));
    expect(agentsController.save).toHaveBeenCalledWith(expect.objectContaining({
      id: "reviewer",
      instructions: "Name the regression first.",
    }));
  });

  it("lists each candidate's own effort levels and marks the ones another candidate clamps", async () => {
    const user = userEvent.setup();
    // Two candidates whose models declare different levels: the menus follow the models, not the
    // composer's current pick.
    const effortModels = [
      { value: "openai/gpt-5.6", label: "GPT-5.6", efforts: ["low", "high"] },
      { value: "openai/gpt-5.6-mini", label: "GPT-5.6 mini", efforts: ["none", "medium"] },
    ];
    const split = {
      ...reviewer,
      models: [{ model: "openai/gpt-5.6" }, { model: "openai/gpt-5.6-mini" }],
    };
    renderPage([...builtins, split], {}, effortModels);
    await user.click(screen.getByRole("button", { name: /Code reviewer/ }));
    const editor = screen.getByRole("region", { name: "Code reviewer" });

    // A candidate row offers only what its own model declares.
    await user.click(within(editor).getByRole("button", { name: new RegExp(`^${t.agentsModelEffort} 1`) }));
    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual([
      t.effortDefault, t.effortLow, t.effortHigh,
    ]);
    await user.keyboard("{Escape}");

    // The agent's default effort offers the union, in Core's order, and says which candidates clamp.
    await user.click(within(editor).getByRole("button", { name: new RegExp(`^${t.agentsDefaultEffort}`) }));
    const rows = screen.getAllByRole("menuitemradio").map((item) => item.textContent);
    expect(rows).toHaveLength(5);
    expect(rows[1]).toContain(t.effortNone);
    expect(rows[1]).toContain(t.agentsEffortClamped.replace("{count}", "1").replace("{total}", "2"));
    expect(rows[2]).toContain(t.effortLow);
    expect(rows[4]).toContain(t.effortHigh);
  });

  it("reorders and removes model candidates, and adds one up to the bound", async () => {
    const user = userEvent.setup();
    const twoModels = { ...reviewer, models: [{ model: "openai/gpt-5.6" }, { model: "openai/gpt-5.6-mini", effort: "low" as const }] };
    const agentsController = renderPage([...builtins, twoModels]);
    await user.click(screen.getByRole("button", { name: /Code reviewer/ }));
    const editor = screen.getByRole("region", { name: "Code reviewer" });

    await user.click(within(editor).getByRole("button", { name: `${t.agentsModelDown} 1` }));
    await user.click(within(editor).getByRole("button", { name: t.agentsSave }));
    expect(agentsController.save).toHaveBeenCalledWith(expect.objectContaining({
      models: [{ model: "openai/gpt-5.6-mini", effort: "low" }, { model: "openai/gpt-5.6" }],
    }));
  });

  it("refuses a duplicate name before it writes anything", async () => {
    const user = userEvent.setup();
    const agentsController = renderPage([...builtins, reviewer]);
    await user.click(screen.getByRole("button", { name: /Code reviewer/ }));
    const editor = screen.getByRole("region", { name: "Code reviewer" });
    const name = within(editor).getByDisplayValue("Code reviewer");
    await user.clear(name);
    await user.type(name, "ask");
    await user.click(within(editor).getByRole("button", { name: t.agentsSave }));
    expect(screen.getByRole("alert")).toHaveTextContent(t.agentNameTaken);
    expect(agentsController.save).not.toHaveBeenCalled();
  });

  it("asks before deleting a custom agent", async () => {
    const user = userEvent.setup();
    const agentsController = renderPage([...builtins, reviewer]);
    await user.click(screen.getByRole("button", { name: /Code reviewer/ }));
    await user.click(screen.getByRole("button", { name: t.agentsDelete }));
    expect(agentsController.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: t.agentsDeleteConfirm }));
    expect(agentsController.remove).toHaveBeenCalledWith("reviewer");
  });

  it("keeps a dirty editor until the user chooses", async () => {
    const user = userEvent.setup();
    renderPage([...builtins, reviewer]);
    await user.click(screen.getByRole("button", { name: /Code reviewer/ }));
    const editor = screen.getByRole("region", { name: "Code reviewer" });
    await user.type(within(editor).getByRole("textbox", { name: new RegExp(t.agentsInstructions) }), " more");
    await user.click(screen.getByRole("button", { name: new RegExp(`^${t.agentAskName}`) }));
    expect(screen.getByText(new RegExp(t.agentsDirtyTitle))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.agentsDirtyStay }));
    expect(screen.getByRole("region", { name: "Code reviewer" })).toBeInTheDocument();
  });

  it("reports what the agents.json import skipped", () => {
    renderPage([...builtins, reviewer], {
      warning: "agents.json was imported with 1 warning(s).",
      importResult: {
        imported: true,
        alreadyImported: false,
        renamedTo: "/home/agents.json.imported",
        custom: 2,
        builtinOverrides: ["ask"],
        skipped: 1,
        warnings: ["profile \"Planner\": model gone/model is not in the catalog; it was dropped"],
      },
    });
    expect(screen.getByText(new RegExp(t.agentsWarning))).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: t.agentsImportTitle });
    expect(panel).toHaveTextContent("/home/agents.json.imported");
    expect(panel).toHaveTextContent(t.agentsImportSkipped.replace("{count}", "1"));
    expect(panel).toHaveTextContent("gone/model");
  });

  it("marks a workspace definition read-only", async () => {
    const user = userEvent.setup();
    const local = entry({ id: "local-helper", name: "Local helper", source: "workspace", editable: false });
    renderPage([...builtins, local]);
    await user.click(screen.getByRole("button", { name: /Local helper/ }));
    const editor = screen.getByRole("region", { name: "Local helper" });
    expect(within(editor).getByText(t.agentsWorkspaceLocked)).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: t.agentsSave })).toBeDisabled();
  });

  it("disables every field of a workspace definition, so nothing can become dirty", async () => {
    const user = userEvent.setup();
    const local = entry({
      id: "local-helper", name: "Local helper", description: "Reads.", source: "workspace", editable: false,
      instructions: "Read only.", models: [{ model: "openai/gpt-5.6" }],
    });
    renderPage([...builtins, local]);
    await user.click(screen.getByRole("button", { name: /Local helper/ }));
    const editor = screen.getByRole("region", { name: "Local helper" });

    expect(within(editor).getByRole("textbox", { name: new RegExp(t.agentsInstructions) })).toBeDisabled();
    expect(within(editor).getByDisplayValue("Reads.")).toBeDisabled();
    expect(within(editor).getByRole("button", { name: new RegExp(`^${t.agentsDefaultEffort}`) })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: new RegExp(`^${t.agentsModels} 1`) })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: `${t.agentsModelUp} 1` })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: t.agentsModelAdd })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: t.agentsSave })).toBeDisabled();
    expect(within(editor).queryByText(t.agentsUnsaved)).toBeNull();
  });

  it("locks delegation and refuses a full policy for an agent that can be delegated to", async () => {
    const user = userEvent.setup();
    const hybrid = entry({
      id: "hybrid", name: "Hybrid", description: "Runs both.", use: "both", policy: "read-only", delegation: "none",
    });
    renderPage([...builtins, hybrid]);
    await user.click(screen.getByRole("button", { name: /Hybrid/ }));
    const editor = screen.getByRole("region", { name: "Hybrid" });

    // Core clears the delegation of every non-conversation agent, so the picker is fixed.
    expect(within(editor).getByRole("button", { name: new RegExp(`^${t.agentsDelegation}`) })).toBeDisabled();
    // And its policy can only be read-only or workspace.
    await user.click(within(editor).getByRole("button", { name: new RegExp(`^${t.agentsPolicy}`) }));
    expect(screen.getByRole("menuitemradio", { name: new RegExp(t.workspace) })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: new RegExp(`^${t.full}`) })).toBeNull();
  });

  it("shows the conflict copy when a save raced another write", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => {
      throw new Error("config file changed since it was read: /home/lumencortex.json");
    });
    renderPage([...builtins, reviewer], { save });
    await user.click(screen.getByRole("button", { name: /Code reviewer/ }));
    const editor = screen.getByRole("region", { name: "Code reviewer" });
    await user.type(within(editor).getByRole("textbox", { name: new RegExp(t.agentsInstructions) }), " more");
    await user.click(within(editor).getByRole("button", { name: t.agentsSave }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t.errConflict);
  });

  it("opens an unsaved draft from a preset and saves nothing until asked", async () => {
    const user = userEvent.setup();
    const preset = entry({
      id: "reviewer", name: "Code reviewer", description: "Reads diffs.", use: "both",
      policy: "read-only", delegation: "none", source: "preset", instructions: "Lead with the risk.",
      models: [{ model: "openai/gpt-5.6", effort: "high" }], ompRole: "slow",
    });
    const agentsController = renderPage([...builtins, reviewer], { presets: vi.fn(async () => [preset]) });

    await user.click(screen.getByRole("button", { name: t.agentsPresetsOpen }));
    const panel = await screen.findByRole("region", { name: t.agentsPresetsTitle });
    expect(within(panel).getByText(t.agentsPresetsModelsFromRole.replace("{role}", "slow"))).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: /Code reviewer/ }));

    const editor = screen.getByRole("region", { name: t.agentsNew });
    expect(within(editor).getByDisplayValue("Code reviewer 2")).toBeInTheDocument();
    expect(within(editor).getByDisplayValue("Lead with the risk.")).toBeInTheDocument();
    expect(agentsController.save).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole("button", { name: t.agentsSave }));
    expect(agentsController.save).toHaveBeenCalledWith(expect.objectContaining({
      id: "", name: "Code reviewer 2", use: "both", policy: "read-only",
    }));
  });

  it("asks before a preset replaces unsaved edits", async () => {
    const user = userEvent.setup();
    const preset = entry({ id: "sonic", name: "Sonic", description: "Mechanical edits.", use: "delegation", policy: "workspace", source: "preset" });
    renderPage([...builtins, reviewer], { presets: vi.fn(async () => [preset]) });
    await user.click(screen.getByRole("button", { name: /Code reviewer/ }));
    const editor = screen.getByRole("region", { name: "Code reviewer" });
    await user.type(within(editor).getByRole("textbox", { name: new RegExp(t.agentsInstructions) }), " more");

    await user.click(screen.getByRole("button", { name: t.agentsPresetsOpen }));
    const panel = await screen.findByRole("region", { name: t.agentsPresetsTitle });
    await user.click(within(panel).getByRole("button", { name: /Sonic/ }));
    expect(screen.getByText(new RegExp(t.agentsDirtyTitle))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.agentsDirtyDiscard }));
    expect(screen.getByRole("region", { name: t.agentsNew })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sonic")).toBeInTheDocument();
  });

  it("reports a catalog that could not be read", () => {
    renderPage([...builtins], {
      loadError: "invalid configuration: agents \"explore-2\" and \"explore\" have the same name",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/have the same name/);
  });
});
