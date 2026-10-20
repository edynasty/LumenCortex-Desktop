import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copy, type AppCopy } from "../../lib/i18n/app-copy";
import {
  filterPickerOptions,
  groupPickerOptions,
  pickerGroups,
  type PickerOption,
} from "./ComposerPickers";
import { ModelPicker } from "./ComposerPickers";
import { MenuPicker } from "./MenuPicker";

const t = copy.en;
const base: PickerOption = { value: "demo/coder", label: "Coder", group: "Demo", description: "upstream-coder · 64K ctx" };
const chat: PickerOption = { value: "other/chat", label: "Chat", group: "Other", description: "chat-model" };
const noTools: PickerOption = { value: "demo/plain", label: "Plain", group: "Demo", description: "", disabled: true, disabledReason: "No tool calling" };

const options = [base, chat, noTools];

describe("picker filtering and grouping", () => {
  it("filters by name, ref, provider and upstream id", () => {
    expect(filterPickerOptions(options, "coder").map((o) => o.value)).toEqual(["demo/coder"]);
    expect(filterPickerOptions(options, "demo/coder").map((o) => o.value)).toEqual(["demo/coder"]);
    expect(filterPickerOptions(options, "other").map((o) => o.value)).toEqual(["other/chat"]);
    expect(filterPickerOptions(options, "upstream").map((o) => o.value)).toEqual(["demo/coder"]);
    expect(filterPickerOptions(options, "  ").length).toBe(3);
    expect(filterPickerOptions(options, "zzz")).toEqual([]);
  });

  it("folds consecutive options under one provider header", () => {
    expect(groupPickerOptions([base, noTools, chat])).toEqual([
      { group: "Demo", options: [base, noTools] },
      { group: "Other", options: [chat] },
    ]);
    // Non-consecutive same-group options keep their own header (catalog order is preserved).
    expect(groupPickerOptions(options)).toHaveLength(3);
  });

  it("puts a bounded Recent group first, keeping only options the filter still shows", () => {
    const groups = pickerGroups(filterPickerOptions(options, ""), ["other/chat", "gone/x", "demo/coder"], "Recent");
    expect(groups[0]).toEqual({ key: "recent", label: "Recent", options: [chat, base] });
    const filtered = pickerGroups(filterPickerOptions(options, "demo"), ["other/chat"], "Recent");
    expect(filtered[0].key).toBe("group-Demo");
  });
});

describe("ModelPicker keyboard flow", () => {
  it("arrows skip disabled rows, Enter picks, Esc closes and returns focus to the chip", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<ModelPicker
      ariaLabel={t.modelSelect} value="" options={options} placeholder={t.noModels}
      searchLabel={t.modelSearch} emptyLabel={t.noModelMatches} recentLabel={t.recentModels}
      recentRefs={[]} onChange={onChange}
    />);
    const trigger = screen.getByRole("button", { name: `${t.modelSelect}: ${t.noModels}` });
    await user.click(trigger);
    const search = screen.getByRole("textbox", { name: t.modelSearch });
    expect(search).toHaveFocus();

    // ArrowDown lands on the first enabled row; the disabled row is skipped by Enter.
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("other/chat");

    fireEvent.keyDown(search, { key: "Escape" });
    rerender(<ModelPicker
      ariaLabel={t.modelSelect} value="" options={options} placeholder={t.noModels}
      searchLabel={t.modelSearch} emptyLabel={t.noModelMatches} recentLabel={t.recentModels}
      recentRefs={[]} onChange={onChange}
    />);
    await Promise.resolve();
  });

  it("marks the current model, shows the pending tag, and refuses disabled rows by click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModelPicker
      ariaLabel={t.modelSelect} value="demo/coder" options={options} placeholder={t.noModels}
      searchLabel={t.modelSearch} emptyLabel={t.noModelMatches} recentLabel={t.recentModels}
      recentRefs={[]} pendingLabel={t.modelPending} onChange={onChange}
    />);
    expect(screen.getByText(t.modelPending)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `${t.modelSelect}: Coder` }));
    const selected = screen.getAllByRole("option").find((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveTextContent("Coder");

    const disabled = screen.getByRole("option", { name: /Plain/ });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<ModelPicker
      ariaLabel={t.modelSelect} value="" options={options} placeholder={t.noModels}
      searchLabel={t.modelSearch} emptyLabel={t.noModelMatches} recentLabel={t.recentModels}
      recentRefs={[]} onChange={() => undefined}
    />);
    await user.click(screen.getByRole("button", { name: `${t.modelSelect}: ${t.noModels}` }));
    await user.type(screen.getByRole("textbox", { name: t.modelSearch }), "zzz");
    expect(screen.getByText(t.noModelMatches)).toBeInTheDocument();
  });
});

describe("MenuPicker", () => {
  it("moves through the menu with arrows and Enter picks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MenuPicker
      ariaLabel={t.agentsPolicy} value="workspace" placeholder={t.workspace}
      options={[
        { value: "read-only", label: t.readOnly },
        { value: "workspace", label: t.workspace },
      ]}
      onChange={onChange}
    />);
    await user.click(screen.getByRole("button", { name: `${t.agentsPolicy}: ${t.workspace}` }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitemradio");
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(items[0]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("read-only");
  });

  it("shows why a capped control is disabled", () => {
    render(<MenuPicker
      ariaLabel={t.policy} value="full" placeholder={t.full} disabled disabledReason={t.agentsDelegationFixed}
      options={[{ value: "full", label: t.full }]} onChange={() => undefined}
    />);
    const chip = screen.getByRole("button", { name: `${t.policy}: ${t.full}` });
    expect(chip).toBeDisabled();
    expect(chip).toHaveAttribute("title", t.agentsDelegationFixed);
  });
});
