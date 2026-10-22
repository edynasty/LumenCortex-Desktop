import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import { RunSettingsPanel } from "./RunSettingsPanel";

const labels = copy.en;

const baseProps: ComponentProps<typeof RunSettingsPanel> = {
  modelRef: "",
  models: [],
  policy: "full",
  maxSteps: 24,
  command: "",
  running: false,
  events: [],
  lspCommand: "",
  lspArgs: "",
  lspLanguage: "",
  lspStatus: { running: false, pendingRequests: 0, diagnostics: 0 },
  lspDiagnosticPath: "",
  lspDiagnostics: [],
  subagents: [],
  workspaceOpen: true,
  selectedSessionId: "",
  busy: false,
  labels,
  onModelChange: () => undefined,
  onOpenProviders: () => undefined,
  onPolicyChange: () => undefined,
  onMaxStepsChange: () => undefined,
  onCommandChange: () => undefined,
  onLSPCommandChange: () => undefined,
  onLSPArgsChange: () => undefined,
  onLSPLanguageChange: () => undefined,
  onLSPDiagnosticPathChange: () => undefined,
  onRefreshLSPDiagnostics: () => undefined,
  onStartLSP: () => undefined,
  onStopLSP: () => undefined,
  onOpenSubagent: () => undefined,
  onRunShell: () => undefined,
};

describe("RunSettingsPanel permission ceiling", () => {
  it("disables the grants above the agent's ceiling and shows what will run instead", async () => {
    const user = userEvent.setup();
    render(<RunSettingsPanel {...baseProps} agentCeiling={{ policy: "read-only", label: "Ask" }} />);

    // Core runs min(grant, ceiling): the trigger names the grant that actually runs.
    const trigger = screen.getByRole("button", { name: new RegExp(`^${labels.policy}`) });
    expect(trigger).toHaveTextContent(labels.readOnly);

    await user.click(trigger);
    expect(screen.getByRole("option", { name: new RegExp(`^${labels.readOnly}`) })).toBeEnabled();
    const reason = labels.agentCapsControls.replace("{agent}", "Ask");
    for (const label of [labels.workspace, labels.full]) {
      const option = screen.getByRole("option", { name: new RegExp(`^${label}`) });
      expect(option).toBeDisabled();
      expect(option).toHaveAttribute("title", reason);
      expect(option).toHaveTextContent(reason);
    }
  });

  it("offers every grant when no agent caps them", async () => {
    const user = userEvent.setup();
    render(<RunSettingsPanel {...baseProps} policy="workspace" />);

    const trigger = screen.getByRole("button", { name: new RegExp(`^${labels.policy}`) });
    expect(trigger).toHaveTextContent(labels.workspace);
    await user.click(trigger);
    for (const label of [labels.readOnly, labels.workspace, labels.full]) {
      expect(screen.getByRole("option", { name: new RegExp(`^${label}`) })).toBeEnabled();
    }
  });
});
