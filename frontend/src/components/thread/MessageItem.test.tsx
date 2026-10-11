import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
};

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
    expect(container.querySelector(".message-row.notice")).not.toBeNull();
    expect(container.querySelector(".thread-tool-card")).toBeNull();
    expect(screen.getByText(t.originToolInterrupted)).toBeTruthy();
    expect(screen.getByText(t.originToolInterruptedBody)).toBeTruthy();
  });

  it("renders completion_blocked as a notice with the stored reason, not as a user message", () => {
    const { container } = render(
      <MessageItem labels={labels} message={row("user", { role: "user", origin: "completion_blocked", content: "Workflow contract rejected completion: tests missing" })} />,
    );
    expect(container.querySelector(".message-row.user")).toBeNull();
    expect(screen.getByText(t.originCompletionBlocked)).toBeTruthy();
    expect(screen.getByText("Workflow contract rejected completion: tests missing")).toBeTruthy();
  });

  it("shows an unknown origin by its raw value", () => {
    render(<MessageItem labels={labels} message={row("user", { role: "user", origin: "future_origin", content: "hello" })} />);
    expect(screen.getByText("future_origin")).toBeTruthy();
  });

  it("keeps ordinary user rows as messages", () => {
    const { container } = render(<MessageItem labels={labels} message={row("user", { role: "user", content: "fix it" })} />);
    expect(container.querySelector(".message-row.user")).not.toBeNull();
    expect(container.querySelector(".notice")).toBeNull();
  });
});
