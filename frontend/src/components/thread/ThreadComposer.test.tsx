import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { copy, type AppCopy } from "../../lib/i18n/app-copy";
import type { ComposerCopy } from "../composer/Composer";
import { ThreadComposer } from "./ThreadComposer";

const t = copy.en;
const labels: ComposerCopy = Object.assign({} as AppCopy, t, { noModels: "No model configured" });

const agentCatalog = [
  {
    id: "ask", name: "Ask", description: "Answers without changing anything.", use: "conversation" as const,
    policy: "read-only" as const, delegation: "none" as const, instructions: "", models: null,
    builtin: true, source: "builtin" as const, digest: "sha256:ask", forConversation: true, editable: true,
  },
  {
    id: "agent", name: "Agent", description: "Works on the task.", use: "conversation" as const,
    policy: "full" as const, delegation: "isolated" as const, instructions: "", models: null,
    builtin: true, source: "builtin" as const, digest: "sha256:agent", forConversation: true, editable: true,
  },
  {
    id: "reviewer", name: "Code reviewer", description: "Reads diffs", use: "conversation" as const,
    policy: "read-only" as const, delegation: "none" as const, instructions: "Lead with risk.", models: null,
    builtin: false, source: "global" as const, digest: "sha256:reviewer", forConversation: true, editable: true,
  },
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
    agent: { agents: agentCatalog, selectedId: "agent", onSelect: vi.fn() },
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

  it("offers the conversation agents and selects by id without touching the model", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const props = renderComposer({ agent: { agents: agentCatalog, selectedId: "agent", onSelect } });

    await user.click(screen.getByRole("button", { name: new RegExp(`^${t.agentSelector}:`) }));
    expect(screen.getByRole("menuitemradio", { name: new RegExp(t.agentAskName) })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitemradio", { name: /Code reviewer/ }));
    expect(onSelect).toHaveBeenCalledWith("reviewer");
    // Switching agent never sends a model: Core re-pins to the new agent's first model.
    expect(props.onModelChange).not.toHaveBeenCalled();
  });

  it("shows the permission Core will run under the agent's ceiling, and explains a cap that leaves no choice", () => {
    renderComposer({ agent: { agents: agentCatalog, selectedId: "ask", onSelect: vi.fn() } });
    const capped = screen.getByRole("button", { name: `${t.policy}: ${t.readOnly}` });
    expect(capped).toBeDisabled();
    expect(capped).toHaveAttribute("title", t.agentCapsControls.replace("{agent}", t.agentAskName));
    cleanup();
    // No ceiling: the user's own grant, editable.
    renderComposer();
    expect(screen.getByRole("button", { name: `${t.policy}: ${t.workspace}` })).toBeEnabled();
  });
});
