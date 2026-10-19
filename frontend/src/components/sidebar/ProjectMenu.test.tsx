/*
 * Project switcher menu: keyboard walk, selection, Escape/Tab close with focus restore, and
 * the per-row copy-path action with its accessible confirmation.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import { Sidebar } from "./Sidebar";

const PROJECTS = [
  "/Users/demo/Projects/lumencortex",
  "/Users/demo/Projects/very-long-workspace-name-with-many-segments",
];

const noop = () => undefined;

function renderSidebar() {
  return render(
    <Sidebar
      label="Sidebar"
      workspace={PROJECTS[0]}
      recentProjects={PROJECTS}
      runtimeState="ready"
      activeRuns={0}
      labels={copy["en"]}
      onPickWorkspace={noop}
      onOpenWorkspace={noop}
    >
      <div />
    </Sidebar>
  );
}

const trigger = () => screen.getByRole("button", { name: /lumencortex/i });
const menu = () => screen.getByRole("menu", { name: "Project menu" });
const rowByName = (name: string | RegExp) => screen.getByRole("menuitemradio", { name });

describe("project switcher menu", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("opens from the trigger with Enter and focuses the current project", async () => {
    const user = userEvent.setup();
    renderSidebar();
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(menu()).toBeInTheDocument();
    expect(rowByName(/lumencortex/)).toHaveFocus();
  });

  it("roves with arrows and Home/End through the rows", async () => {
    const user = userEvent.setup();
    renderSidebar();
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(rowByName(/lumencortex/)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(rowByName(/very-long-workspace/)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(rowByName(/lumencortex/)).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: /Open project…/ })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(rowByName(/very-long-workspace/)).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(rowByName(/lumencortex/)).toHaveFocus();
  });

  it("Enter selects the project, closes the menu and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    const onOpenWorkspace = vi.fn();
    const { rerender } = renderSidebar();
    rerender(
      <Sidebar
        label="Sidebar"
        workspace={PROJECTS[0]}
        recentProjects={PROJECTS}
        runtimeState="ready"
        activeRuns={0}
        labels={copy["en"]}
        onPickWorkspace={noop}
        onOpenWorkspace={onOpenWorkspace}
      >
        <div />
      </Sidebar>
    );
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}"); // current row -> the second project
    await user.keyboard("{Enter}");
    expect(onOpenWorkspace).toHaveBeenCalledWith(PROJECTS[1]);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("Escape closes and restores focus; Tab closes without trapping focus", async () => {
    const user = userEvent.setup();
    renderSidebar();
    trigger().focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{Enter}");
    await user.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("copies a project path from its row with an accessible confirmation", async () => {
    const user = userEvent.setup();
    renderSidebar();
    trigger().focus();
    await user.keyboard("{Enter}");

    await user.keyboard("{ArrowRight}");
    const copyButton = screen.getAllByRole("menuitem", { name: "Copy path" })[0];
    expect(copyButton).toHaveFocus();
    await user.keyboard("{Enter}");
    // userEvent's clipboard stub captured what the component wrote.
    expect(await navigator.clipboard.readText()).toBe(PROJECTS[0]);
    expect(copyButton).toHaveClass("is-copied");
    expect(screen.getByRole("status")).toHaveTextContent("Path copied");
    expect(screen.getAllByRole("menuitem", { name: "Path copied" })).toHaveLength(1);
    expect(menu()).toBeInTheDocument(); // copying keeps the menu open
  });
});
