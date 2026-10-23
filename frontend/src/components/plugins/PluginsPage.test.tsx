import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { PluginCatalog, PluginInfo } from "../../types";
import { usePluginsPage } from "./usePluginsPage";
import type { PluginCatalogController } from "./usePluginCatalog";

const labels = copy.en;

const ompPlugin: PluginInfo = {
  manifest: {
    id: "omp-import",
    name: "OMP session import",
    version: "1.0.0",
    description: "Reads oh-my-pi (OMP) JSONL sessions read-only.",
    apiVersion: 1,
    capabilities: ["session-import"],
    icon: "import",
  },
  builtin: true,
  enabled: true,
  state: "running",
  importSource: { id: "omp", name: "OMP", converter: 1, defaultRoot: "/home/.omp/agent/sessions" },
};

const quietPlugin: PluginInfo = {
  manifest: { id: "quiet", name: "Quiet plugin", version: "0.2.0", apiVersion: 1, capabilities: ["events.subscribe"] },
  builtin: false,
  enabled: true,
  state: "registered",
};

function controller(plugins: PluginInfo[], patch: Partial<PluginCatalogController> = {}): PluginCatalogController {
  const catalog: PluginCatalog = { apiVersion: 1, plugins };
  return {
    catalog,
    state: "ready",
    error: "",
    busyId: "",
    toggleError: "",
    reload: vi.fn(),
    toggle: vi.fn(),
    ...patch,
  };
}

function Page({ control, onOpenImport = vi.fn(), onOpenSettings = vi.fn() }: {
  control: PluginCatalogController;
  onOpenImport?: (sourceId: string) => void;
  onOpenSettings?: () => void;
}) {
  const page = usePluginsPage({
    enabled: true,
    workspace: "/repo/demo",
    labels,
    controller: control,
    onOpenImport,
    onOpenSettings,
  });
  return <div><div className="sidebar">{page.sidebar}</div>{page.content}</div>;
}

describe("Plugins page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lists Core's plugins and shows the selected one with its entry", async () => {
    const user = userEvent.setup();
    const onOpenImport = vi.fn();
    render(<Page control={controller([ompPlugin, quietPlugin])} onOpenImport={onOpenImport} />);

    const row = screen.getByRole("button", { name: /OMP session import/ });
    expect(row.querySelector(".plugin-state-dot")).toHaveClass("is-running");
    expect(screen.getByRole("button", { name: /Quiet plugin/ }).querySelector(".plugin-state-dot")).toHaveClass("is-registered");
    expect(screen.getByRole("heading", { name: "OMP session import" })).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Reads oh-my-pi (OMP) JSONL sessions read-only.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: labels.pluginEntryImport }));
    expect(onOpenImport).toHaveBeenCalledWith("omp");
  });

  it("switches the selected plugin from the sidebar", async () => {
    const user = userEvent.setup();
    render(<Page control={controller([ompPlugin, quietPlugin])} />);

    await user.click(screen.getByRole("button", { name: /Quiet plugin/ }));
    expect(screen.getByRole("heading", { name: "Quiet plugin" })).toBeInTheDocument();
    // No capability Desktop knows: the plugin is still listed, without an entry.
    expect(screen.getByText(labels.pluginNoEntries)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: labels.pluginEntryImport })).toBeNull();
    expect(screen.queryByRole("switch", { name: labels.pluginRailShow })).toBeNull();
  });

  it("disables the entry of a disabled plugin and says why", () => {
    render(<Page control={controller([{ ...ompPlugin, enabled: false, state: "disabled" }])} />);

    expect(screen.getByRole("button", { name: labels.pluginEntryImport })).toBeDisabled();
    expect(screen.getByText(labels.pluginEntryDisabled)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: labels.pluginRailShow })).toBeDisabled();
  });

  it("writes the toolbar preference and keeps the switch in step", async () => {
    const user = userEvent.setup();
    render(<Page control={controller([ompPlugin])} />);

    const toggle = screen.getByRole("switch", { name: labels.pluginRailShow });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(JSON.parse(localStorage.getItem("lcx-rail-plugins") ?? "[]")).toEqual(["omp-import"]);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(JSON.parse(localStorage.getItem("lcx-rail-plugins") ?? "[]")).toEqual([]);
  });

  it("enables a plugin through the controller", async () => {
    const user = userEvent.setup();
    const control = controller([{ ...ompPlugin, enabled: false, state: "disabled" }]);
    render(<Page control={control} />);

    await user.click(screen.getByRole("switch", { name: "OMP session import" }));
    expect(control.toggle).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("reports failures and links to the settings diagnostics", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <Page
        control={controller([{ ...ompPlugin, state: "failed", error: "start: omp directory is unreadable" }])}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("omp directory is unreadable");
    await user.click(screen.getByRole("button", { name: labels.pluginSettingsLink }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("keeps the page usable while the catalog is still loading", () => {
    render(<Page control={controller([], { state: "loading", catalog: null })} />);
    expect(screen.getAllByText(labels.pluginsLoading).length).toBeGreaterThan(0);
  });

  it("shows the no-project notice without a workspace", () => {
    function NoProject() {
      const page = usePluginsPage({
        enabled: true,
        workspace: "",
        labels,
        controller: controller([ompPlugin]),
        onOpenImport: vi.fn(),
        onOpenSettings: vi.fn(),
      });
      return <div>{page.content}</div>;
    }
    render(<NoProject />);
    expect(screen.getByText(labels.settingsNoProject)).toBeInTheDocument();
  });
});
