import type { ComponentProps } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import { setPluginRailVisible } from "../../lib/rail-plugins";
import type { BuildInfo, PluginInfo } from "../../types";
import { Rail } from "./Rail";

const mocks = vi.hoisted(() => ({ buildInfo: vi.fn() }));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels = copy.en;

const build: BuildInfo = {
  app: "LumenCortex Desktop",
  appVersion: "0.1.0",
  commit: "0f6d9214c2ab7c1d5e8f3a9b6d4c2e1f0a9b8c7d",
  commitSource: "ldflags",
  builtAt: "2026-10-22T18:04:00Z",
  coreModule: "github.com/edynasty/LumenCortex",
  coreVersion: "v0.1.2",
  coreLocal: false,
  coreRuntimeVersion: "0.1.2-preview",
  goVersion: "go1.24.3",
  goos: "darwin",
  goarch: "arm64",
};

const ompPlugin: PluginInfo = {
  manifest: {
    id: "omp-import",
    name: "OMP session import",
    version: "1.0.0",
    apiVersion: 1,
    capabilities: ["session-import"],
    icon: "import",
  },
  builtin: true,
  enabled: true,
  state: "running",
  importSource: { id: "omp", name: "OMP", converter: 1 },
};

const quietPlugin: PluginInfo = {
  manifest: { id: "quiet", name: "Quiet plugin", version: "0.2.0", apiVersion: 1, capabilities: [] },
  builtin: false,
  enabled: true,
  state: "registered",
};

function renderRail(overrides: Partial<ComponentProps<typeof Rail>> = {}) {
  const props = {
    page: "threads" as const,
    settingsOpen: false,
    attention: 0,
    worktrees: 0,
    plugins: [ompPlugin],
    labels,
    onNavigate: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenAbout: vi.fn(),
    onOpenImport: vi.fn(),
    ...overrides,
  };
  render(<Rail {...props} />);
  return props;
}

describe("Rail", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const fn of Object.values(mocks)) fn.mockReset();
    mocks.buildInfo.mockResolvedValue(build);
  });

  it("offers the Plugins page on ⌘5", () => {
    renderRail();
    const button = screen.getByRole("button", { name: labels.pluginsPage });
    expect(button).toHaveAttribute("title", `${labels.pluginsPage} ⌘5`);
    expect(button.querySelector("svg")).toHaveClass("lucide-puzzle");
  });

  it("pins an enabled plugin's primary entry and opens its source", async () => {
    const user = userEvent.setup();
    const props = renderRail({ plugins: [ompPlugin, quietPlugin] });

    const entry = screen.getByRole("button", { name: labels.pluginEntryImport });
    expect(entry).toHaveAttribute("title", `${labels.pluginEntryImport} · OMP session import`);
    // The manifest's semantic icon name becomes the import glyph, not the generic puzzle.
    expect(entry.querySelector("svg")).toHaveClass("lucide-file-input");
    await user.click(entry);
    expect(props.onOpenImport).toHaveBeenCalledWith("omp");
  });

  it("drops a hidden or disabled plugin from the rail", () => {
    const { unmount } = render(<Rail
      page="threads" settingsOpen={false} attention={0} worktrees={0} plugins={[ompPlugin]} labels={labels}
      onNavigate={vi.fn()} onOpenSettings={vi.fn()} onOpenAbout={vi.fn()} onOpenImport={vi.fn()}
    />);
    expect(screen.getByRole("button", { name: labels.pluginEntryImport })).toBeInTheDocument();
    act(() => setPluginRailVisible("omp-import", false));
    expect(screen.queryByRole("button", { name: labels.pluginEntryImport })).toBeNull();
    unmount();

    renderRail({ plugins: [{ ...ompPlugin, enabled: false, state: "disabled" }] });
    expect(screen.queryByRole("button", { name: labels.pluginEntryImport })).toBeNull();
  });

  it("shows the build version and opens About", async () => {
    const user = userEvent.setup();
    const props = renderRail();

    const version = await screen.findByRole("button", { name: `${labels.aboutVersion} v0.1.0` });
    expect(version).toHaveTextContent("v0.1.0");
    expect(version).toHaveAttribute("title", "LumenCortex Desktop v0.1.0 · 0f6d921");
    await user.click(version);
    expect(props.onOpenAbout).toHaveBeenCalledTimes(1);
  });
});
