import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigState, CredentialStatus, ProviderCatalogDocument } from "../../types";
import { ProviderSettingsPanel } from "./ProviderSettingsPanel";

const mocks = vi.hoisted(() => ({
  providerCatalogScope: vi.fn(),
  saveProviderCatalogScope: vi.fn(),
  providerCredentialStatus: vi.fn(),
  saveProviderCredential: vi.fn(),
  removeProviderCredential: vi.fn(),
  testProviderConnection: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: {
    providerCatalogScope: mocks.providerCatalogScope,
    saveProviderCatalogScope: mocks.saveProviderCatalogScope,
    providerCredentialStatus: mocks.providerCredentialStatus,
    saveProviderCredential: mocks.saveProviderCredential,
    removeProviderCredential: mocks.removeProviderCredential,
    testProviderConnection: mocks.testProviderConnection,
    discoverProviderModels: vi.fn(),
  },
}));

const KEY = "sk-live-NEVER-PRINT-9876543210";

const config: ConfigState = {
  workspace: "",
  trusted: false,
  model: "",
  failover: [],
  models: [],
  warnings: [],
  globalPath: "/home/.config/lumencortex/lumencortex.json",
  globalDigest: "sha256:g",
};

function fileDoc(digest: string, providers: ProviderCatalogDocument["catalog"]["providers"] = {}): ProviderCatalogDocument {
  return { scope: "global", path: "/home/.config/lumencortex/lumencortex.json", digest, catalog: { providers } };
}

function status(overrides: Partial<CredentialStatus> = {}): CredentialStatus {
  return {
    providerId: "deepseek",
    scope: "global",
    source: "none",
    set: false,
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <ProviderSettingsPanel
      locale="en"
      workspace=""
      config={config}
      trusting={false}
      onTrust={() => undefined}
      onConfigChanged={() => undefined}
      onError={() => undefined}
    />
  );
}

/** The typed key must survive nowhere outside the password input while it is being typed. */
function expectKeyNowhereInDom() {
  expect(document.body.textContent).not.toContain(KEY);
  expect(document.body.innerHTML).not.toContain(KEY);
  for (const input of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")) {
    if (input.type === "password") continue;
    expect(input.value).not.toContain(KEY);
  }
}

describe("ProviderCredentialSection (through the panel)", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.providerCatalogScope.mockReset();
    mocks.saveProviderCatalogScope.mockReset();
    mocks.providerCredentialStatus.mockReset();
    mocks.saveProviderCredential.mockReset();
    mocks.removeProviderCredential.mockReset();
    mocks.testProviderConnection.mockReset();
    mocks.providerCatalogScope.mockResolvedValue(
      fileDoc("sha256:one", {
        deepseek: { name: "DeepSeek", package: "openai-compatible", settings: { apiKey: "{env:DEEPSEEK_API_KEY}" }, models: {} },
      }),
    );
    mocks.providerCredentialStatus.mockResolvedValue(
      status({ source: "env", ref: "{env:DEEPSEEK_API_KEY}", set: false }),
    );
  });

  it("shows one field: the env reference as visible text with a set/not-set status", async () => {
    renderPanel();

    const field = await screen.findByLabelText("API key", { selector: "input" });
    // The placeholder text is not a secret, so the field renders it as plain text.
    expect(field).toHaveValue("${DEEPSEEK_API_KEY}");
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByText("Reads environment variable DEEPSEEK_API_KEY (not set)")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("radiogroup", { name: "Source" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("saving an edited ${NAME} placeholder sends it and adopts the env status", async () => {
    const user = userEvent.setup();
    mocks.saveProviderCredential.mockResolvedValue(
      status({ source: "env", ref: "{env:DEEPSEEK_API_KEY}", set: true }),
    );
    renderPanel();

    const field = await screen.findByLabelText("API key", { selector: "input" });
    // fireEvent.change sets the whole value at once (userEvent.type parses "{" as an escape).
    fireEvent.change(field, { target: { value: "${MY_PROVIDER_KEY}" } });
    expect(field).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveProviderCredential).toHaveBeenCalledWith("global", "deepseek", "${MY_PROVIDER_KEY}"));
    expect(await screen.findByText("Reads environment variable DEEPSEEK_API_KEY (set)")).toBeInTheDocument();
    expect(field).toHaveValue("${DEEPSEEK_API_KEY}");
  });

  it("a literal is masked while typed, stored on save, never rendered, and offered as Replace", async () => {
    const user = userEvent.setup();
    mocks.saveProviderCredential.mockResolvedValue(
      status({ source: "stored", ref: "{secret:provider.global.deepseek.a1b2c3d4}", set: true }),
    );
    renderPanel();

    const field = await screen.findByLabelText("API key", { selector: "input" });
    fireEvent.change(field, { target: { value: KEY } });
    // A literal stays masked (type=password) while it is the field's value.
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.saveProviderCredential).toHaveBeenCalledWith("global", "deepseek", KEY));

    // Cleared after the call; only the fixed status is shown, never the value. The stored
    // literal is not read back: the field falls back to the dot-mask placeholder.
    await waitFor(() => expect(field).toHaveValue(""));
    expect(field).toHaveAttribute("placeholder", "••••••••");
    expect(await screen.findByText("Saved locally")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expectKeyNowhereInDom();
  });

  it("save failure clears the input and shows only a redacted generic message", async () => {
    const user = userEvent.setup();
    // The rejection tries to smuggle the key back; the section must drop it.
    mocks.saveProviderCredential.mockRejectedValue(new Error(`credentials file refused: ${KEY}`));
    renderPanel();

    const field = await screen.findByLabelText("API key", { selector: "input" });
    fireEvent.change(field, { target: { value: KEY } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Saving the API key failed.")).toBeInTheDocument();
    // After a failed save the field falls back to the (visible) env reference, not the key.
    await waitFor(() => expect(field).toHaveValue("${DEEPSEEK_API_KEY}"));
    expectKeyNowhereInDom();
    expect(mocks.saveProviderCredential).toHaveBeenCalledTimes(1);
  });

  it("remove requires an inline confirm and calls RemoveProviderCredential", async () => {
    const user = userEvent.setup();
    mocks.providerCredentialStatus.mockResolvedValue(
      status({ source: "stored", ref: "{secret:provider.global.deepseek.a1b2c3d4}", set: true }),
    );
    mocks.removeProviderCredential.mockResolvedValue(status({ source: "none", set: false }));
    renderPanel();

    expect(await screen.findByText("Saved locally")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.removeProviderCredential).not.toHaveBeenCalled();
    expect(screen.getByText("Remove the API key stored on this machine?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm removal" }));
    await waitFor(() => expect(mocks.removeProviderCredential).toHaveBeenCalledWith("global", "deepseek"));
    expect(await screen.findByText("No API key configured")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("tests the connection through the shared runtime action with a visible result", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = Promise.withResolvers<{ ok: boolean; models: number; message: string }>();
    mocks.testProviderConnection.mockImplementation(() => promise);
    renderPanel();

    await screen.findByText("Reads environment variable DEEPSEEK_API_KEY (not set)");
    const test = within(screen.getByRole("region", { name: "API key" })).getByRole("button", { name: "Test connection" });
    await user.click(test);
    expect(mocks.testProviderConnection).toHaveBeenCalledWith("deepseek");
    await waitFor(() => expect(test).toBeDisabled());

    resolve({ ok: true, models: 2, message: "Connected" });
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    await waitFor(() => expect(test).toBeEnabled());
  });
});
