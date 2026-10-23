import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { BuildInfo, Health } from "../../types";
import { AboutPane } from "./SettingsPanes";

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

const health: Health = {
  version: "9.9.9-runtime",
  workspace: "/repo/demo",
  database: "/home/demo/lumencortex.db",
  budget: { softBytes: 1024, hardBytes: 2048, maxAgents: 4 },
  usedBytes: 0,
  pressure: false,
};

function renderAbout(overrides: Partial<BuildInfo> = {}, onError = vi.fn()) {
  mocks.buildInfo.mockResolvedValue({ ...build, ...overrides });
  render(<AboutPane labels={labels} locale="en" health={health} workspace="/repo/demo" onError={onError} />);
  return { onError };
}

describe("About pane", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
  });

  it("shows the Desktop version and the Core identity as separate rows", async () => {
    renderAbout();

    expect(await screen.findByText("v0.1.0")).toBeInTheDocument();
    expect(screen.getByText(labels.aboutVersion)).toBeInTheDocument();
    expect(screen.getByText("v0.1.2")).toBeInTheDocument();
    expect(screen.getByText("0.1.2-preview")).toBeInTheDocument();
    expect(screen.getByText("0f6d921")).toBeInTheDocument();
    expect(screen.getByText("go1.24.3")).toBeInTheDocument();
    expect(screen.getByText("darwin/arm64")).toBeInTheDocument();
    expect(screen.getByText("/home/demo/lumencortex.db")).toBeInTheDocument();
    // Core's health version is the runtime, never presented as the app version.
    expect(screen.queryByText("9.9.9-runtime")).toBeNull();
  });

  it("marks a local Core replace and a dirty commit", async () => {
    renderAbout({ coreLocal: true, coreLocalPath: "/Users/demo/LumenCortex-Core", commit: `${build.commit}-dirty` });

    expect(await screen.findByText(/local replace/)).toBeInTheDocument();
    expect(screen.getByText(/\/Users\/demo\/LumenCortex-Core/)).toBeInTheDocument();
    expect(screen.getByText("0f6d921-dirty")).toBeInTheDocument();
  });

  it("copies the version summary", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderAbout();

    await user.click(await screen.findByRole("button", { name: labels.aboutCopyVersion }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain("Desktop version: v0.1.0");
    expect(text).toContain("Core module: v0.1.2");
    expect(text).toContain("Commit: 0f6d921");
    expect(text).toContain("Current project: /repo/demo");
    expect(screen.getByRole("button", { name: labels.aboutCopiedVersion })).toBeInTheDocument();
  });

  it("still shows the Desktop version row while GetBuildInfo is pending", () => {
    mocks.buildInfo.mockReturnValue(new Promise(() => undefined));
    render(<AboutPane labels={labels} locale="en" workspace="" onError={vi.fn()} />);
    expect(screen.getByText(labels.aboutVersion)).toBeInTheDocument();
  });
});
