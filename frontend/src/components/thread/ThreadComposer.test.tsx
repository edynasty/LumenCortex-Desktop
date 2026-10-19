import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { copy, type AppCopy } from "../../lib/i18n/app-copy";
import type { ComposerCopy } from "../composer/Composer";
import { ThreadComposer } from "./ThreadComposer";

const t = copy.en;
const labels: ComposerCopy = Object.assign({} as AppCopy, t, { noModels: "No model configured" });

const agentProfiles = [
  { id: "ask", name: "Ask", base: "ask" as const, instructions: "", policy: "read-only" as const, builtin: true },
  { id: "agent", name: "Agent", base: "agent" as const, instructions: "", policy: "workspace" as const, builtin: true },
  { id: "reviewer", name: "Code reviewer", description: "Reads diffs", base: "ask" as const, instructions: "Lead with risk.", builtin: false },
];

function renderComposer(overrides: Partial<Parameters<typeof ThreadComposer>[0]> = {}) {
  const props = {
    runtime: { kind: "local" as const, path: "/repo" },
    copy: labels,
    projectName: "repo",
    projectPath: "/repo",
    modelRef: "",
    models: [],
    recentModelRefs: [],
    effortOptions: [],
    mode: "agent" as const,
    agent: { profiles: agentProfiles, selectedId: "agent", onSelect: vi.fn() },
    policy: "workspace" as const,
    contextPaths: [],
    goal: "",
    running: false,
    busy: false,
    textareaRef: null,
    onGoalChange: vi.fn(),
    onModelChange: vi.fn(),
    onPolicyChange: vi.fn(),
    onEffortChange: vi.fn(),
    onPickContextFiles: vi.fn(),
    onPickContextFolder: vi.fn(),
    onRemoveContextPath: vi.fn(),
    onOpenProviders: vi.fn(),
    onCancel: vi.fn(),
    onSubmit: vi.fn((event: { preventDefault: () => void }) => event.preventDefault()),
    ...overrides,
  };
  render(<ThreadComposer {...props} />);
  return props;
}

describe("ThreadComposer", () => {
  it("disables send until follow-up text exists and sends on Enter", async () => {
    const user = userEvent.setup();
    const props = renderComposer();
    const input = screen.getByRole("textbox", { name: t.startAnother });
    expect(screen.getByRole("button", { name: t.resume })).toBeDisabled();
    await user.type(input, "next step");
    expect(props.onGoalChange).toHaveBeenCalled();
  });

  it("shows a stop control while the agent is running", async () => {
    const user = userEvent.setup();
    const props = renderComposer({ running: true, goal: "continue" });
    await user.click(screen.getByRole("button", { name: t.stop }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("Enter submits and Shift+Enter does not", () => {
    const props = renderComposer({ goal: "continue" });
    const input = screen.getByRole("textbox", { name: t.startAnother });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(props.onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not send while an IME composition is confirming (isComposing Enter)", () => {
    const props = renderComposer({ goal: "continue" });
    const input = screen.getByRole("textbox", { name: t.startAnother });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(props.onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(props.onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps the runtime identity read-only in the strip above the input", () => {
    renderComposer({ runtime: { kind: "worktree", path: "/wt", branch: "lumencortex/task" } });
    const chip = screen.getByTitle(t.runtimeFixed);
    expect(chip).toBeInTheDocument();
    expect(chip.closest(".composer-env")).not.toBeNull();
    expect(chip.closest(".composer-bar")).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(t.environment) })).toBeNull();
    expect(screen.queryByRole("button", { name: t.configureEnvironment })).toBeNull();
  });

  it("offers the built-in and custom agents and selects by id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderComposer({ agent: { profiles: agentProfiles, selectedId: "agent", onSelect } });

    await user.click(screen.getByRole("button", { name: new RegExp(`^${t.agentSelector}:`) }));
    expect(screen.getByRole("menuitemradio", { name: new RegExp(t.agentAskName) })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitemradio", { name: /Code reviewer/ }));
    expect(onSelect).toHaveBeenCalledWith("reviewer");
  });

  it("caps the permission control when the selected agent's base is Ask", () => {
    renderComposer({ mode: "ask" });
    expect(screen.getByRole("button", { name: `${t.policy}: ${t.workspace}` })).toBeDisabled();
  });
});
