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
});
