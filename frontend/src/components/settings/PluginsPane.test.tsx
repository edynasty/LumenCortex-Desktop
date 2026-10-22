import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { PluginCatalog, PluginInfo } from "../../types";
import { PluginsPane } from "./PluginsPane";

const mocks = vi.hoisted(() => ({
  plugins: vi.fn(),
  setPluginEnabled: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels = copy.en;

const ompPlugin: PluginInfo = {
  manifest: {
    id: "omp-import",
    name: "OMP session import",
    version: "1.0.0",
    description: "Reads oh-my-pi (OMP) JSONL sessions read-only and imports their visible history.",
    apiVersion: 1,
    capabilities: ["session-import"],
  },
  builtin: true,
  enabled: true,
  state: "running",
  importSource: { id: "omp", name: "OMP", converter: 1, defaultRoot: "/home/.omp/agent/sessions" },
};

function catalog(plugins: PluginInfo[], patch: Partial<PluginCatalog> = {}): PluginCatalog {
  return {
    apiVersion: 1,
    plugins,
    statePath: "/home/.config/lumencortex/plugins.json",
    ...patch,
  };
}

function renderPane(onError = vi.fn()) {
  render(<PluginsPane labels={labels} locale="en" onError={onError} />);
  return { onError };
}

describe("PluginsPane", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
  });

  it("lists a plugin with its identity, state and capabilities", async () => {
    mocks.plugins.mockResolvedValue(catalog([ompPlugin]));
    renderPane();

    expect(await screen.findByText("OMP session import")).toBeInTheDocument();
    expect(screen.getByText("omp-import")).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("session-import")).toBeInTheDocument();
    expect(screen.getByText(labels.pluginsBuiltin)).toBeInTheDocument();
    expect(screen.getByText(labels.pluginsStateRunning)).toBeInTheDocument();
    expect(screen.getByText("/home/.config/lumencortex/plugins.json")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "OMP session import" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows a failed plugin's error, failure count and last failure", async () => {
    mocks.plugins.mockResolvedValue(catalog([
      { ...ompPlugin, enabled: true, state: "failed", error: "start: omp directory is unreadable", failures: 3, lastFailureAt: new Date().toISOString() },
    ]));
    renderPane();

    expect(await screen.findByText(labels.pluginsStateFailed)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("omp directory is unreadable");
    const counts = screen.getByText(new RegExp(labels.pluginsFailures.replace("{count}", "3")));
    expect(counts).toHaveTextContent(labels.pluginsLastFailure.split("{value}")[0].trim());
  });

  it("disables the plugin through the bridge and re-reads the catalog", async () => {
    const user = userEvent.setup();
    mocks.plugins
      .mockResolvedValueOnce(catalog([ompPlugin]))
      .mockResolvedValueOnce(catalog([{ ...ompPlugin, enabled: false, state: "disabled" }]));
    mocks.setPluginEnabled.mockResolvedValue(undefined);
    renderPane();

    const toggle = await screen.findByRole("switch", { name: "OMP session import" });
    await user.click(toggle);

    expect(mocks.setPluginEnabled).toHaveBeenCalledWith("omp-import", false);
    await waitFor(() => expect(mocks.plugins).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(labels.pluginsStateDisabled)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "OMP session import" })).toHaveAttribute("aria-checked", "false");
  });

  it("shows a refused toggle inline and reports it", async () => {
    const user = userEvent.setup();
    mocks.plugins.mockResolvedValue(catalog([ompPlugin]));
    mocks.setPluginEnabled.mockRejectedValue("plugin state file is invalid: /home/.config/lumencortex/plugins.json");
    const { onError } = renderPane();

    await user.click(await screen.findByRole("switch", { name: "OMP session import" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(labels.pluginsToggleError);
    expect(alert).toHaveTextContent("plugin state file is invalid");
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("plugin state file is invalid"));
    expect(mocks.plugins).toHaveBeenCalledTimes(1);
  });

  it("shows the state file error Core reports", async () => {
    mocks.plugins.mockResolvedValue(catalog([ompPlugin], { stateError: "plugins.json: invalid JSON" }));
    renderPane();

    expect(await screen.findByRole("alert")).toHaveTextContent("plugins.json: invalid JSON");
  });

  it("says so when no plugin is registered", async () => {
    mocks.plugins.mockResolvedValue(catalog([]));
    renderPane();

    expect(await screen.findByText(labels.pluginsEmpty)).toBeInTheDocument();
  });
});
