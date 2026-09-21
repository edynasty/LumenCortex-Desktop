import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DesktopSelect } from "./Select";

describe("DesktopSelect", () => {
  it("selects grouped options and closes the popover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DesktopSelect
        ariaLabel="Model"
        value=""
        placeholder="Choose model"
        onChange={onChange}
        options={[
          { value: "deepseek/coder", label: "Coder", group: "DeepSeek", description: "64K ctx" },
          { value: "openrouter/sonnet", label: "Sonnet", group: "OpenRouter" },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Model" }));
    expect(screen.getByText("DeepSeek")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Coder/ }));
    expect(onChange).toHaveBeenCalledWith("deepseek/coder");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <DesktopSelect
        ariaLabel="Policy"
        value="workspace"
        placeholder="Policy"
        onChange={() => undefined}
        options={[{ value: "workspace", label: "Workspace" }]}
      />
    );
    await user.click(screen.getByRole("button", { name: "Policy" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
