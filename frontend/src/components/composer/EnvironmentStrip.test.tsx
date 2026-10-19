import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copy, type AppCopy } from "../../lib/i18n/app-copy";
import type { ComposerCopy } from "./Composer";
import { EnvironmentStrip } from "./EnvironmentStrip";

const t = copy.en;
const labels: ComposerCopy = Object.assign({} as AppCopy, t, { noModels: "No model configured" });

describe("EnvironmentStrip", () => {
  it("shows the project read-only and switches the execution target from the gear popover", async () => {
    const user = userEvent.setup();
    const onRuntimeChange = vi.fn();
    const onPickWorkspace = vi.fn();
    render(
      <EnvironmentStrip
        variant="new"
        copy={labels}
        projectName="lumencortex"
        projectPath="/Users/demo/Projects/lumencortex"
        runtime="local"
        onRuntimeChange={onRuntimeChange}
        onPickWorkspace={onPickWorkspace}
      />,
    );

    const project = screen.getByTitle("/Users/demo/Projects/lumencortex");
    expect(project).toHaveTextContent("lumencortex");
    expect(project.closest("button")).toBeNull();
    expect(screen.getByText(t.localRuntime)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.configureEnvironment }));
    const toggle = screen.getByRole("switch", { name: t.newWorktree });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(onRuntimeChange).toHaveBeenCalledWith("worktree");

    expect(screen.getByText(t.branch)).toBeInTheDocument();
    expect(screen.getByText(t.scmHead)).toHaveAttribute("title", t.baseBranchFixed);
    expect(screen.getByText(t.runtimeFixedHint)).toBeInTheDocument();
  });

  it("offers one Open project action and no environment controls without a project", () => {
    render(
      <EnvironmentStrip
        variant="new"
        copy={labels}
        projectName=""
        projectPath=""
        runtime="local"
        onRuntimeChange={vi.fn()}
        onPickWorkspace={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: t.openProject })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.configureEnvironment })).toBeDisabled();
    expect(screen.queryByText(t.localRuntime)).toBeNull();
  });

  it("shows a thread's fixed runtime identity and no environment controls", () => {
    render(
      <EnvironmentStrip
        variant="thread"
        copy={labels}
        projectName="lumencortex"
        projectPath="/Users/demo/Projects/lumencortex"
        runtime={{ kind: "worktree", path: "/wt/task", branch: "lumencortex/task" }}
      />,
    );
    expect(screen.getByTitle(t.runtimeFixed)).toBeInTheDocument();
    expect(screen.getByText("lumencortex/task")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.configureEnvironment })).toBeNull();
  });
});
