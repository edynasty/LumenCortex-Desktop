import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import { SettingsSheet } from "./SettingsSheet";

vi.mock("../provider/ProviderSettingsPanel", () => ({
  ProviderSettingsPanel: () => <input aria-label="Provider draft" defaultValue="" />,
}));

const noop = () => undefined;
const baseProps: ComponentProps<typeof SettingsSheet> = {
  open: true,
  pane: "models",
  locale: "en",
  labels: copy.en,
  themePreference: "system",
  workspace: "/repo/demo",
  config: {
    workspace: "/repo/demo",
    trusted: true,
    model: "",
    failover: [],
    models: [],
    warnings: [],
    globalPath: "/home/lumencortex.json",
    globalDigest: "sha256:g",
    concurrency: {
      current: { maxAgents: 4, maxChildrenPerParent: 3 },
      default: { maxAgents: 4, maxChildrenPerParent: 3 },
      max: { maxAgents: 16, maxChildrenPerParent: 8 },
    },
  },
  trusting: false,
  sessionId: "",
  runtime: { kind: "local", path: "/repo/demo" },
  onPaneChange: noop,
  onClose: noop,
  onLocaleChange: noop,
  onThemePreferenceChange: noop,
  onTrust: noop,
  onConfigChanged: noop,
  onError: noop,
};

describe("SettingsSheet provider keepalive", () => {
  it("keeps an unsaved provider draft across pane switches and closing the sheet", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SettingsSheet {...baseProps} />);

    const draft = screen.getByRole("textbox", { name: "Provider draft" });
    await user.type(draft, "unsaved-provider");

    rerender(<SettingsSheet {...baseProps} pane="general" />);
    expect(draft).not.toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Appearance" })).toBeVisible();

    rerender(<SettingsSheet {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();

    rerender(<SettingsSheet {...baseProps} />);
    expect(screen.getByRole("textbox", { name: "Provider draft" })).toHaveValue("unsaved-provider");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsSheet {...baseProps} pane="general" onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("edits the global provider catalog before any project is open", () => {
    render(<SettingsSheet {...baseProps} workspace="" config={{ ...baseProps.config, workspace: "", trusted: false }} />);
    // The provider panel is mounted for the global file; only its project scope needs a project.
    expect(screen.getByRole("textbox", { name: "Provider draft" })).toBeVisible();
    expect(screen.queryByText(copy.en.settingsNoProject)).toBeNull();
  });

  it("keeps the project-scoped panes behind the open-a-project notice", () => {
    const { rerender } = render(<SettingsSheet {...baseProps} workspace="" pane="permissions" />);
    expect(screen.getByText(copy.en.settingsNoProject)).toBeVisible();

    rerender(<SettingsSheet {...baseProps} workspace="" pane="skills" />);
    expect(screen.getByText(copy.en.settingsNoProject)).toBeVisible();

    rerender(<SettingsSheet {...baseProps} workspace="" pane="plugins" />);
    expect(screen.getByText(copy.en.settingsNoProject)).toBeVisible();
  });

  it("shows About without a project", () => {
    render(<SettingsSheet {...baseProps} workspace="" pane="about" />);
    expect(screen.getByText(copy.en.aboutVersion)).toBeVisible();
  });
});
