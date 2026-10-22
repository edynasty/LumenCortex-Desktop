import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigState, ProviderCatalogDocument, ProviderCatalogScope } from "../../types";
import { ProviderSettingsPanel } from "./ProviderSettingsPanel";

const mocks = vi.hoisted(() => ({
  providerCatalogScope: vi.fn(),
  saveProviderCatalogScope: vi.fn(),
  providerCredentialStatus: vi.fn(),
  saveProviderCredential: vi.fn(),
  removeProviderCredential: vi.fn(),
  reasoningFormats: vi.fn(),
  reasoningEfforts: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: {
    providerCatalogScope: mocks.providerCatalogScope,
    saveProviderCatalogScope: mocks.saveProviderCatalogScope,
    providerCredentialStatus: mocks.providerCredentialStatus,
    saveProviderCredential: mocks.saveProviderCredential,
    removeProviderCredential: mocks.removeProviderCredential,
    testProviderConnection: vi.fn(),
    discoverProviderModels: vi.fn(),
    reasoningFormats: mocks.reasoningFormats,
    reasoningEfforts: mocks.reasoningEfforts,
  },
}));

const config: ConfigState = {
  workspace: "",
  trusted: false,
  model: "",
  failover: [],
  models: [],
  warnings: [],
  globalPath: "/home/.config/lumencortex/lumencortex.json",
  globalDigest: "sha256:g",
  concurrency: {
    current: { maxAgents: 4, maxChildrenPerParent: 3 },
    default: { maxAgents: 4, maxChildrenPerParent: 3 },
    max: { maxAgents: 16, maxChildrenPerParent: 8 },
  },
};

function anthropicFile(): ProviderCatalogDocument {
  return {
    scope: "global",
    path: "/home/.config/lumencortex/lumencortex.json",
    digest: "sha256:one",
    catalog: {
      providers: {
        "local-anthropic": {
          name: "Local",
          package: "anthropic-messages",
          settings: { baseURL: "http://localhost:8080" },
          models: { opus: { name: "Opus", modelID: "opus" } },
        },
      },
    },
  };
}

function renderPanel(overrides: { onError?: (message: string) => void } = {}) {
  return render(
    <ProviderSettingsPanel
      locale="en"
      workspace=""
      config={config}
      trusting={false}
      onTrust={() => undefined}
      onConfigChanged={() => undefined}
      onError={overrides.onError ?? (() => undefined)}
    />,
  );
}

/** Opens the model form of the first model: the provider's Edit button comes first. */
async function openModelForm(user: UserEvent) {
  const edits = await screen.findAllByRole("button", { name: "Edit" });
  await user.click(edits[edits.length - 1]);
  await waitFor(() => expect(document.querySelector(".provider-model-form")).not.toBeNull());
  return within(document.querySelector(".provider-model-form") as HTMLElement);
}

describe("model reasoning settings", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.providerCatalogScope.mockResolvedValue(anthropicFile());
    mocks.providerCredentialStatus.mockResolvedValue({ providerId: "local-anthropic", scope: "global", source: "none", set: false });
    // Core's answer for the anthropic-messages package: the default and adaptive, nothing else.
    mocks.reasoningFormats.mockResolvedValue(["", "adaptive"]);
    // Core's levels for the package: adaptive thinking accepts neither none nor minimal.
    mocks.reasoningEfforts.mockResolvedValue({ levels: ["none", "minimal", "low", "medium", "high", "xhigh", "max"], accepted: { "": ["none", "minimal", "low", "medium", "high", "xhigh", "max"], adaptive: ["low", "medium", "high", "xhigh", "max"] } });
  });

  it("takes the format choices from Core for the provider's package", async () => {
    const user = userEvent.setup();
    renderPanel();
    const form = await openModelForm(user);

    await waitFor(() => expect(mocks.reasoningFormats).toHaveBeenCalledWith("anthropic-messages"));
    const trigger = form.getByRole("button", { name: "Reasoning format" });
    expect(trigger).toHaveTextContent("Package default");

    await user.click(trigger);
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Package default", "adaptive"]);
    // A value another package implements is not offered here.
    expect(screen.queryByRole("option", { name: "deepseek" })).not.toBeInTheDocument();
  });

  it("offers Core's levels and saves adaptive with the levels that were ticked", async () => {
    const user = userEvent.setup();
    mocks.saveProviderCatalogScope.mockImplementation(async (_scope: ProviderCatalogScope, sent: ProviderCatalogDocument) => ({ ...sent, digest: "sha256:two" }));
    renderPanel();
    const form = await openModelForm(user);

    await user.click(form.getByRole("button", { name: "Reasoning format" }));
    await user.click(screen.getByRole("option", { name: "adaptive" }));

    // The levels adaptive does not accept are refused before the save is; the rest of Core's ladder,
    // xhigh included, is offered.
    await waitFor(() => expect(mocks.reasoningEfforts).toHaveBeenCalledWith("anthropic-messages"));
    expect(form.getByRole("checkbox", { name: "None" })).toBeDisabled();
    expect(form.getByRole("checkbox", { name: "Minimal" })).toBeDisabled();
    await user.click(form.getByRole("checkbox", { name: "Low" }));
    await user.click(form.getByRole("checkbox", { name: "Extra high" }));
    expect(form.getByRole("checkbox", { name: "Low" })).toBeChecked();

    await user.click(form.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveProviderCatalogScope).toHaveBeenCalledTimes(1));

    const [, sent] = mocks.saveProviderCatalogScope.mock.calls[0]!;
    const provider = (sent as ProviderCatalogDocument).catalog.providers["local-anthropic"]!;
    expect(provider.models!.opus!.reasoning).toEqual({
      format: "adaptive",
      efforts: ["low", "xhigh"],
    });
    // The fields outside the edit are untouched.
    expect(provider.package).toBe("anthropic-messages");
  });

  it("drops a ticked level the newly chosen format does not accept", async () => {
    const user = userEvent.setup();
    mocks.saveProviderCatalogScope.mockImplementation(async (_scope: ProviderCatalogScope, sent: ProviderCatalogDocument) => ({ ...sent, digest: "sha256:two" }));
    renderPanel();
    const form = await openModelForm(user);
    await waitFor(() => expect(mocks.reasoningEfforts).toHaveBeenCalledWith("anthropic-messages"));

    await user.click(form.getByRole("checkbox", { name: "Minimal" }));
    await user.click(form.getByRole("checkbox", { name: "Max" }));
    await user.click(form.getByRole("button", { name: "Reasoning format" }));
    await user.click(screen.getByRole("option", { name: "adaptive" }));
    expect(form.getByRole("checkbox", { name: "Minimal" })).not.toBeChecked();

    await user.click(form.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveProviderCatalogScope).toHaveBeenCalledTimes(1));
    const [, sent] = mocks.saveProviderCatalogScope.mock.calls[0]!;
    expect((sent as ProviderCatalogDocument).catalog.providers["local-anthropic"]!.models!.opus!.reasoning)
      .toEqual({ format: "adaptive", efforts: ["max"] });
  });

  it("shows Core's refusal in the form instead of only in the app notice", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const refusal =
      'invalid configuration: providers.local-anthropic.models.opus.reasoning.efforts: "none" is not accepted with reasoning.format "adaptive"';
    mocks.saveProviderCatalogScope.mockRejectedValue(new Error(refusal));
    renderPanel({ onError });
    const form = await openModelForm(user);

    await user.click(form.getByRole("button", { name: "Reasoning format" }));
    await user.click(screen.getByRole("option", { name: "adaptive" }));
    await user.click(form.getByRole("button", { name: "Save" }));

    expect(await form.findByRole("alert")).toHaveTextContent(refusal);
    // The model form is still open, so the edit is not lost, and the app banner stays quiet.
    expect(document.querySelector(".provider-model-form")).not.toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
});
