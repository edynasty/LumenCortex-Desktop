import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThreadComposer } from "./ThreadComposer";

const labels = {
  startAnother: "Continue",
  composerHint: "Enter to send",
  noModels: "No models",
  modelSearch: "Search models",
  noModelMatches: "No matching models",
  start: "Start",
  running: "Running",
  localRuntime: "Local",
  worktreeRuntime: "Worktree",
};

describe("ThreadComposer", () => {
  it("disables send until follow-up text exists", async () => {
    const user = userEvent.setup();
    const onGoalChange = vi.fn();
    render(
      <ThreadComposer
        runtime={{ kind: "local", path: "/repo" }}
        workspaceName="repo"
        modelRef=""
        models={[]}
        policyLabel="Workspace"
        goal=""
        running={false}
        busy={false}
        textareaRef={null}
        labels={labels}
        onGoalChange={onGoalChange}
        onModelChange={() => undefined}
        onCancel={() => undefined}
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Continue" }), "next step");
    expect(onGoalChange).toHaveBeenCalled();
  });

  it("shows a stop control while the agent is running", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ThreadComposer
        runtime={{ kind: "worktree", path: "/wt", branch: "lumencortex/task" }}
        workspaceName="repo"
        modelRef=""
        models={[]}
        policyLabel="Workspace"
        goal="continue"
        running
        busy={false}
        textareaRef={null}
        labels={labels}
        onGoalChange={() => undefined}
        onModelChange={() => undefined}
        onCancel={onCancel}
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: "Running" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
