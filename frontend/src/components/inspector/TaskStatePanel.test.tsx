import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { RuntimeEvent, TaskStateInfo } from "../../types";
import { TaskStatePanel } from "./TaskStatePanel";

const mocks = vi.hoisted(() => ({
  taskState: vi.fn(),
  setTaskBrief: vi.fn(),
  editTaskReference: vi.fn(),
  resolveThread: vi.fn(),
  resetContext: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels = copy.en;

function info(patch: Partial<TaskStateInfo["state"]> = {}, rest: Partial<TaskStateInfo> = {}): TaskStateInfo {
  return {
    sessionId: "s1",
    version: 3,
    pendingEdits: 0,
    state: { brief: "Fix the window", resolution: { state: "open" }, windowStartSeq: 0, ...patch },
    obligations: [],
    readyForReview: false,
    ...rest,
  };
}

function event(seq: number, type: string, sessionId = "s1"): RuntimeEvent {
  return { seq, at: "2026-10-17T00:00:00Z", type, sessionId };
}

describe("TaskStatePanel", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("shows Core's view, sets the resolution as the user, and hides obligations once resolved", async () => {
    const obligations: TaskStateInfo["obligations"] = ["work_units", "pending_application"];
    mocks.taskState.mockResolvedValue(info({}, { obligations }));
    mocks.resolveThread.mockResolvedValue(info({ resolution: { state: "done", by: "user", actor: "desktop-user" } }, { obligations }));
    render(<TaskStatePanel sessionId="s1" running={false} events={[]} labels={labels} />);

    expect(await screen.findByText(labels.taskObligationWorkUnits)).toBeTruthy();
    expect(screen.getByText(labels.taskObligationPendingApplication)).toBeTruthy();
    expect(screen.getByRole("radio", { name: labels.taskResolutionOpen }).getAttribute("aria-checked")).toBe("true");

    await userEvent.click(screen.getByRole("radio", { name: labels.taskResolutionDone }));
    expect(mocks.resolveThread).toHaveBeenCalledWith("s1", "done");
    await waitFor(() => expect(screen.getByRole("radio", { name: labels.taskResolutionDone }).getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByText(labels.taskResolvedByUser)).toBeTruthy();
    expect(screen.queryByText(labels.taskObligationWorkUnits)).toBeNull();
  });

  it("saves only a changed brief, trimmed, and shows that it applies at the next step", async () => {
    mocks.taskState.mockResolvedValue(info());
    mocks.setTaskBrief.mockResolvedValue(info({ brief: "Keep the API" }, { pendingEdits: 1 }));
    render(<TaskStatePanel sessionId="s1" running events={[]} labels={labels} />);

    const field = await screen.findByRole("textbox", { name: labels.taskBrief });
    await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe("Fix the window"));
    const save = screen.getByRole("button", { name: labels.taskBriefSave });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await userEvent.clear(field);
    await userEvent.type(field, "  Keep the API  ");
    await userEvent.click(save);
    expect(mocks.setTaskBrief).toHaveBeenCalledWith("s1", "Keep the API");
    expect(await screen.findByText(labels.taskPendingEdits.replace("{count}", "1"))).toBeTruthy();
  });

  it("adds a path and excludes a suggested reference", async () => {
    const suggested = { id: "ref_1", kind: "path", target: "internal/window/window.go", state: "suggested", by: "agent", at: "" };
    mocks.taskState.mockResolvedValue(info({ references: [suggested] }));
    mocks.editTaskReference.mockImplementation(async (_id: string, edit: { target: string; state: string }) =>
      info({ references: [{ ...suggested, target: edit.target, state: edit.state }] }),
    );
    render(<TaskStatePanel sessionId="s1" running={false} events={[]} labels={labels} />);

    expect(await screen.findByText(labels.taskReferenceSuggested)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: labels.taskReferenceExclude }));
    expect(mocks.editTaskReference).toHaveBeenCalledWith("s1", { kind: "path", target: "internal/window/window.go", state: "excluded" });

    await userEvent.type(screen.getByRole("textbox", { name: labels.taskReferenceAdd }), " cmd/main.go ");
    await userEvent.click(screen.getByRole("button", { name: labels.taskReferenceAdd }));
    expect(mocks.editTaskReference).toHaveBeenLastCalledWith("s1", { kind: "path", target: "cmd/main.go", state: "included" });
  });

  it("disables reset while running and presents a held run as running elsewhere", async () => {
    mocks.taskState.mockResolvedValue(info());
    mocks.resetContext.mockRejectedValue("run is active in another process or engine");
    const { rerender } = render(<TaskStatePanel pane="window" sessionId="s1" running events={[]} labels={labels} />);

    const reset = await screen.findByRole("button", { name: labels.taskResetContext });
    await waitFor(() => expect(mocks.taskState).toHaveBeenCalled());
    expect((reset as HTMLButtonElement).disabled).toBe(true);

    rerender(<TaskStatePanel pane="window" sessionId="s1" running={false} events={[]} labels={labels} />);
    await waitFor(() => expect((reset as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(reset);
    expect((await screen.findByRole("alert")).textContent).toBe(labels.runningElsewhereError);
  });

  it("re-reads on this session's Task State events only", async () => {
    mocks.taskState.mockResolvedValue(info());
    const history = [event(1, "task_state.changed")];
    const { rerender } = render(<TaskStatePanel sessionId="s1" running events={history} labels={labels} />);
    await waitFor(() => expect(mocks.taskState).toHaveBeenCalledTimes(1));

    rerender(<TaskStatePanel sessionId="s1" running events={[...history, event(2, "tool.output"), event(3, "task_state.changed", "s2")]} labels={labels} />);
    rerender(<TaskStatePanel sessionId="s1" running events={[...history, event(2, "tool.output"), event(3, "task_state.changed", "s2"), event(4, "task_state.edits_applied")]} labels={labels} />);
    await waitFor(() => expect(mocks.taskState).toHaveBeenCalledTimes(2));
    const settled = Promise.withResolvers<void>();
    setTimeout(settled.resolve, 20);
    await settled.promise;
    expect(mocks.taskState).toHaveBeenCalledTimes(2);
  });
});
