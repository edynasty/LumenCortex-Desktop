import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { AgentEntry, EffectivePrompt } from "../../types";
import { EffectivePromptPanel } from "./EffectivePromptPanel";

const mocks = vi.hoisted(() => ({ effectivePrompt: vi.fn() }));

vi.mock("../../lib/bridge", () => ({ bridge: { effectivePrompt: mocks.effectivePrompt } }));

const t = copy.en;

const agent: AgentEntry = {
  id: "agent",
  name: "Agent",
  description: "Works on the task.",
  use: "conversation",
  policy: "workspace",
  delegation: "propose",
  instructions: "",
  models: null,
  builtin: true,
  source: "builtin",
  digest: "sha256:agent",
  forConversation: true,
  editable: true,
};

function prompt(overrides: Partial<EffectivePrompt> = {}): EffectivePrompt {
  return {
    workspace: "/repo/demo",
    trusted: false,
    agent: "agent",
    policy: "workspace",
    delegation: "propose",
    layers: [
      {
        kind: "builtin", source: "core", scope: "core", included: true, bytes: 12, text: "You are LumenCortex.",
      },
      {
        kind: "project-instructions", source: "/repo/demo/AGENTS.md", scope: "project",
        included: false, reason: "untrusted workspace", bytes: 0,
      },
      {
        kind: "agent-instructions", source: "agent:agent (builtin)", scope: "agent",
        included: false, reason: "none", bytes: 0,
      },
    ],
    tools: [
      { name: "read_file", permission: "read", source: "builtin", included: true },
      { name: "write_file", permission: "write", source: "builtin", included: true },
      { name: "shell", permission: "exec", source: "builtin", included: false, reason: "policy" },
      { name: "recall", permission: "read", source: "task", included: true },
      { name: "mcp_search", permission: "read", source: "mcp:docs", included: true },
    ],
    warnings: [],
    ...overrides,
  };
}

function renderPanel(overrides: {
  workspace?: string;
  creating?: boolean;
  dirty?: boolean;
  trusted?: boolean;
  onTrust?: () => void;
} = {}) {
  return render(
    <EffectivePromptPanel
      labels={t}
      workspace={overrides.workspace ?? "/repo/demo"}
      sessionId=""
      agent={agent}
      creating={overrides.creating ?? false}
      dirty={overrides.dirty ?? false}
      trusted={overrides.trusted ?? false}
      trusting={false}
      onTrust={overrides.onTrust ?? (() => undefined)}
    />,
  );
}

describe("EffectivePromptPanel", () => {
  beforeEach(() => {
    mocks.effectivePrompt.mockReset();
    mocks.effectivePrompt.mockResolvedValue(prompt());
  });

  it("asks Core for the agent's prompt with the host's grant", async () => {
    renderPanel();
    await waitFor(() => expect(mocks.effectivePrompt).toHaveBeenCalledTimes(1));
    expect(mocks.effectivePrompt).toHaveBeenCalledWith({
      sessionId: undefined,
      agent: "agent",
      policy: "workspace",
      delegation: "propose",
      interactive: true,
    });
  });

  it("shows every layer in order with its kind, source, scope and whether it is loaded", async () => {
    renderPanel();
    const list = await screen.findByRole("list", { name: t.promptLayers });
    const layers = within(list).getAllByRole("listitem");
    expect(layers).toHaveLength(3);
    expect(layers[0]).toHaveTextContent(t.promptKindBuiltin);
    expect(layers[0]).toHaveTextContent(t.promptIncluded);
    expect(layers[1]).toHaveTextContent(t.promptKindProjectInstructions);
    expect(layers[1]).toHaveTextContent(t.promptNotLoaded);
    expect(layers[1]).toHaveTextContent("/repo/demo/AGENTS.md");
    expect(layers[1]).toHaveTextContent(t.promptScopeProject);
    // The reason is Core's, shown in the app language.
    expect(layers[1]).toHaveTextContent(t.promptReasonUntrusted);
    expect(layers[2]).toHaveTextContent(t.promptReasonNoAgentInstructions);
  });

  it("keeps a layer collapsed until it is expanded, then shows its text", async () => {
    const user = userEvent.setup();
    renderPanel();
    const layers = within(await screen.findByRole("list", { name: t.promptLayers })).getAllByRole("listitem");
    const details = layers[0]!.querySelector("details")!;
    // Collapsed by default: the summary carries the provenance, the body stays folded away.
    expect(details).not.toHaveAttribute("open");
    expect(within(layers[0]!).getByText(t.promptBytes.replace("{bytes}", "12"))).toBeInTheDocument();

    await user.click(within(layers[0]!).getByText(t.promptKindBuiltin));
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("You are LumenCortex.")).toBeInTheDocument();
  });

  it("groups tools by source and marks each one offered or withheld with the filter's reason", async () => {
    renderPanel();
    await screen.findByRole("list", { name: t.promptLayers });
    const builtin = screen.getByRole("region", { name: t.promptSourceBuiltin });
    expect(within(builtin).getByText("read_file")).toBeInTheDocument();
    const shell = within(builtin).getByText("shell").closest("li")!;
    expect(shell).toHaveTextContent(t.promptToolsExcluded);
    expect(shell).toHaveTextContent(t.promptReasonPolicy);
    expect(within(builtin).getByText("read_file").closest("li")).toHaveTextContent(t.promptToolsIncluded);

    // Each source is its own group; an MCP server is named by id.
    expect(screen.getByRole("region", { name: t.promptSourceTask })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "MCP · docs" })).toBeInTheDocument();
  });

  it("offers trust for an untrusted workspace and drops the offer once it is trusted", async () => {
    const user = userEvent.setup();
    const onTrust = vi.fn();
    const { rerender } = renderPanel({ onTrust });
    expect(await screen.findByText(t.promptUntrusted)).toBeInTheDocument();
    expect(screen.getByText(t.promptUntrustedHint)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.configTrustWorkspace }));
    expect(onTrust).toHaveBeenCalledTimes(1);

    mocks.effectivePrompt.mockResolvedValue(prompt({ trusted: true }));
    rerender(
      <EffectivePromptPanel
        labels={t}
        workspace="/repo/demo"
        sessionId=""
        agent={agent}
        creating={false}
        dirty={false}
        trusted
        trusting={false}
        onTrust={onTrust}
      />,
    );
    expect(await screen.findByText(t.promptTrusted)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.configTrustWorkspace })).not.toBeInTheDocument();
    // Trust changes what Core loads, so the panel asks again.
    await waitFor(() => expect(mocks.effectivePrompt).toHaveBeenCalledTimes(2));
  });

  it("says a project is needed instead of calling Core without one", async () => {
    renderPanel({ workspace: "" });
    expect(screen.getByText(t.promptNoProject)).toBeInTheDocument();
    expect(mocks.effectivePrompt).not.toHaveBeenCalled();
  });

  it("asks for a save first when the agent has never been saved", async () => {
    renderPanel({ creating: true });
    expect(screen.getByText(t.promptSaveFirst)).toBeInTheDocument();
    expect(mocks.effectivePrompt).not.toHaveBeenCalled();
  });

  it("shows Core's refusal and notes that a dirty draft describes the saved agent", async () => {
    mocks.effectivePrompt.mockRejectedValue(new Error("agent \"draft\" is not in the catalog"));
    renderPanel({ dirty: true });
    expect(await screen.findByRole("alert")).toHaveTextContent('agent "draft" is not in the catalog');
    expect(screen.getByText(t.promptDirtyNote)).toBeInTheDocument();
  });
});
