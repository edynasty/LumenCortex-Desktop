import { render, screen, waitFor } from "@testing-library/react";
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

  it("filters searchable options and supports keyboard selection from search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DesktopSelect
        ariaLabel="Model"
        value=""
        placeholder="Choose model"
        onChange={onChange}
        search={{ ariaLabel: "Search models", placeholder: "Search models", emptyLabel: "No models found" }}
        options={[
          { value: "openai/gpt", label: "GPT", group: "OpenAI", description: "128K ctx", badge: "Default" },
          { value: "deepseek/chat", label: "DeepSeek Chat", group: "DeepSeek", keywords: "reasoning coder" },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Model" }));
    const search = screen.getByRole("textbox", { name: "Search models" });
    await waitFor(() => expect(search).toHaveFocus());

    await user.type(search, "reasoning");
    expect(screen.queryByRole("option", { name: /GPT/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /DeepSeek Chat/ })).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /DeepSeek Chat/ })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("deepseek/chat");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the configured empty result message for search", async () => {
    const user = userEvent.setup();
    render(
      <DesktopSelect
        ariaLabel="Model"
        value=""
        placeholder="Choose model"
        onChange={() => undefined}
        search={{ ariaLabel: "Search models", placeholder: "Search models", emptyLabel: "No models found" }}
        options={[{ value: "openai/gpt", label: "GPT" }]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Model" }));
    await user.type(screen.getByRole("textbox", { name: "Search models" }), "missing");
    expect(screen.getByText("No models found")).toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
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
    const trigger = screen.getByRole("button", { name: "Policy" });
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("supports arrow-key option navigation and restores focus after selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DesktopSelect
        ariaLabel="Model"
        value="openai/gpt-5.6"
        placeholder="Model"
        onChange={onChange}
        options={[
          { value: "openai/gpt-5.6", label: "GPT-5.6" },
          { value: "deepseek/chat", label: "DeepSeek Chat" },
          { value: "local/qwen", label: "Qwen" },
        ]}
      />
    );

    const trigger = screen.getByRole("button", { name: "Model" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("option", { name: "GPT-5.6" })).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "DeepSeek Chat" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("option", { name: "Qwen" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("local/qwen");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
