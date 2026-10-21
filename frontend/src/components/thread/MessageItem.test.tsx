import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { Message } from "../../types";
import { MessageItem } from "./MessageItem";

const t = copy.en;
const labels = {
  roleUser: t.messageRoleUser,
  roleAssistant: t.messageRoleAssistant,
  roleTool: t.messageRoleTool,
  roleSystem: t.messageRoleSystem,
  copy: t.copy,
  copied: t.copied,
  runtimeNotice: t.runtimeNotice,
  originToolInterrupted: t.originToolInterrupted,
  originToolInterruptedBody: t.originToolInterruptedBody,
  originCompletionBlocked: t.originCompletionBlocked,
  originResume: t.originResume,
  originTurn: t.originTurn,
  workTitle: t.workTitle,
  workCalls: t.workCalls,
  showOutput: t.showOutput,
  hideOutput: t.hideOutput,
  remember: t.remember,
  remembered: t.remembered,
  rememberTitle: t.rememberTitle,
  rememberSave: t.rememberSave,
  rememberCancel: t.rememberCancel,
  rememberClipped: t.rememberClipped,
  taskNoteBytes: t.taskNoteBytes,
};

describe("MessageItem Remember", () => {
  it("seeds the editor with the message cut to the note bound and saves the edited text", async () => {
    const onRemember = vi.fn().mockResolvedValue("");
    render(<MessageItem labels={labels} onRemember={onRemember} message={row("assistant", { role: "assistant", content: "x".repeat(600) })} />);

    await userEvent.click(screen.getByRole("button", { name: t.rememberTitle }));
    const field = screen.getByRole("textbox", { name: t.remember }) as HTMLTextAreaElement;
    expect(field.value).toBe("x".repeat(512));
    expect(screen.getByText(t.rememberClipped.replace("{max}", "512"))).toBeTruthy();

    await userEvent.clear(field);
    await userEvent.type(field, "  rel- prefix since 1.4  ");
    await userEvent.click(screen.getByRole("button", { name: t.rememberSave }));
    expect(onRemember).toHaveBeenCalledWith("rel- prefix since 1.4");
    expect(screen.queryByRole("textbox", { name: t.remember })).toBeNull();
    expect(screen.getByRole("button", { name: t.remembered })).toBeTruthy();
  });

  it("keeps the editor open with Core's refusal, and is not offered on runtime notices", async () => {
    const onRemember = vi.fn().mockResolvedValue("This thread already has 32 notes you wrote.");
    const { unmount } = render(<MessageItem labels={labels} onRemember={onRemember} message={row("user", { role: "user", content: "use the beta flag" })} />);
    await userEvent.click(screen.getByRole("button", { name: t.rememberTitle }));
    await userEvent.click(screen.getByRole("button", { name: t.rememberSave }));
    expect(onRemember).toHaveBeenCalledWith("use the beta flag");
    expect(screen.getByRole("alert").textContent).toContain("32 notes");
    expect(screen.getByRole("textbox", { name: t.remember })).toBeTruthy();
    unmount();

    render(<MessageItem labels={labels} onRemember={onRemember} message={row("user", { role: "user", origin: "completion_blocked", content: "blocked" })} />);
    expect(screen.queryByRole("button", { name: t.rememberTitle })).toBeNull();
  });
});

function row(role: string, json: Record<string, unknown>): Message {
  return { sessionId: "s", seq: 3, role, json };
}

describe("MessageItem runtime rows", () => {
  it("renders a tool_interrupted result as a notice, not a tool card", () => {
    const { container } = render(
      <MessageItem
        labels={labels}
        message={row("tool", { role: "tool", tool_call_id: "c1", origin: "tool_interrupted", content: "run ended before the tool result was saved" })}
      />,
    );
    expect(container.querySelector(".notice-line")).not.toBeNull();
    expect(container.querySelector(".work-group")).toBeNull();
    expect(screen.getByText(t.originToolInterrupted)).toBeTruthy();
    expect(screen.getByText(t.originToolInterruptedBody)).toBeTruthy();
  });

  it("renders completion_blocked as a notice with the stored reason, not as a user message", () => {
    const { container } = render(<MessageItem labels={labels} message={row("user", { role: "user", origin: "completion_blocked", content: "Workflow contract rejected completion: tests missing" })} />);
    expect(container.querySelector(".msg-user")).toBeNull();
    expect(screen.getByText(t.originCompletionBlocked)).toBeTruthy();
    expect(screen.getByText("Workflow contract rejected completion: tests missing")).toBeTruthy();
  });

  it("shows an unknown origin by its raw value", () => {
    render(<MessageItem labels={labels} message={row("user", { role: "user", origin: "future_origin", content: "hello" })} />);
    expect(screen.getByText("future_origin")).toBeTruthy();
  });

  it("keeps ordinary user rows as quiet bubbles", () => {
    const { container } = render(<MessageItem labels={labels} message={row("user", { role: "user", content: "fix it" })} />);
    expect(container.querySelector(".msg-user-bubble")).not.toBeNull();
    expect(container.querySelector(".notice-line")).toBeNull();
  });

  it("folds a plain tool call into a work group", () => {
    const { container } = render(<MessageItem labels={labels} message={row("tool", { role: "tool", name: "search_text", content: JSON.stringify({ path: "internal/backend/provider_config.go", ok: true }) })} />);
    expect(container.querySelector(".work-group")).not.toBeNull();
    expect(container.querySelector(".notice-line")).toBeNull();
  });

  it("shows nothing for an assistant row that only calls tools, so its JSON is neither text, copied nor remembered", () => {
    const { container } = render(
      <MessageItem
        labels={labels}
        onRemember={vi.fn()}
        message={row("assistant", { role: "assistant", tool_calls: [{ id: "c1", name: "wait_subagent", arguments: "{}" }] })}
      />,
    );
    expect(container.textContent).toBe("");
    expect(container.querySelector("button")).toBeNull();
  });

  it("keeps the text of an assistant row that also calls tools", () => {
    render(
      <MessageItem
        labels={labels}
        onRemember={vi.fn()}
        message={row("assistant", { role: "assistant", content: "Handing this to the auditor.", tool_calls: [{ id: "c1", name: "spawn_subagent", arguments: "{}" }] })}
      />,
    );
    expect(screen.getByText("Handing this to the auditor.")).toBeTruthy();
    expect(screen.getByRole("button", { name: t.rememberTitle })).toBeTruthy();
  });
});
