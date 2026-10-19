import { render, screen, waitFor, within } from "@testing-library/react";
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
    keychainAvailable: true,
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

  it("shows the env status and switches to the Keychain source", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText("Environment variable DEEPSEEK_API_KEY is not set")).toBeInTheDocument();
    expect(screen.getByText("Environment variable DEEPSEEK_API_KEY is not set")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("radio", { name: "Environment variable" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "macOS Keychain" }));
    const keyField = screen.getByLabelText("API key", { selector: "input" });
    expect(keyField).toHaveAttribute("type", "password");
    expect(keyField).toHaveAttribute("autocomplete", "new-password");
    expect(keyField).toHaveAttribute("spellcheck", "false");
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("save sends the key once, clears the input, replaces and never renders it", async () => {
    const user = userEvent.setup();
    mocks.saveProviderCredential.mockResolvedValue(
      status({ source: "keychain", ref: "{secret:provider.global.deepseek.a1b2c3d4}", set: true }),
    );
    renderPanel();

    await screen.findByText("Environment variable DEEPSEEK_API_KEY is not set");
    await user.click(screen.getByRole("radio", { name: "macOS Keychain" }));
    const keyField = screen.getByLabelText("API key", { selector: "input" });
    await user.type(keyField, KEY);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.saveProviderCredential).toHaveBeenCalledTimes(1));
    expect(mocks.saveProviderCredential).toHaveBeenCalledWith("global", "deepseek", KEY);

    // Cleared after the call; only the fixed status/reference is shown, never the value.
    await waitFor(() => expect(keyField).toHaveValue(""));
    expect(screen.getByText("Saved in Keychain")).toBeInTheDocument();
    expectKeyNowhereInDom();

    // A saved key turns Save into Replace, which reuses the same bridge call.
    await user.type(keyField, "sk-second-NEVER-PRINT-1111");
    await user.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(mocks.saveProviderCredential).toHaveBeenCalledTimes(2));
    expect(mocks.saveProviderCredential).toHaveBeenLastCalledWith("global", "deepseek", "sk-second-NEVER-PRINT-1111");
    await waitFor(() => expect(keyField).toHaveValue(""));

    // The catalog reloads: the composer's model list is refreshed after the write.
    expect(mocks.providerCatalogScope.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("save failure clears the input and shows only a redacted generic message", async () => {
    const user = userEvent.setup();
    // The rejection tries to smuggle the key back; the section must drop it.
    mocks.saveProviderCredential.mockRejectedValue(new Error(`keychain refused: ${KEY}`));
    renderPanel();

    await screen.findByText("Environment variable DEEPSEEK_API_KEY is not set");
    await user.click(screen.getByRole("radio", { name: "macOS Keychain" }));
    const keyField = screen.getByLabelText("API key", { selector: "input" });
    await user.type(keyField, KEY);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Saving the API key failed.")).toBeInTheDocument();
    await waitFor(() => expect(keyField).toHaveValue(""));
    expectKeyNowhereInDom();
    expect(mocks.saveProviderCredential).toHaveBeenCalledTimes(1);
  });

  it("remove requires an inline confirm and calls RemoveProviderCredential", async () => {
    const user = userEvent.setup();
    mocks.providerCredentialStatus.mockResolvedValue(
      status({ source: "keychain", ref: "{secret:provider.global.deepseek.a1b2c3d4}", set: true }),
    );
    mocks.removeProviderCredential.mockResolvedValue(status({ source: "none", set: false }));
    renderPanel();

    expect(await screen.findByText("Saved in Keychain")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.removeProviderCredential).not.toHaveBeenCalled();
    expect(screen.getByText("Remove the API key from the Keychain?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm removal" }));
    await waitFor(() => expect(mocks.removeProviderCredential).toHaveBeenCalledWith("global", "deepseek"));
    expect(await screen.findByText("No API key configured")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("disables the Keychain source with an explanation when unavailable", async () => {
    mocks.providerCredentialStatus.mockResolvedValue(
      status({ source: "env", ref: "{env:DEEPSEEK_API_KEY}", set: true, keychainAvailable: false }),
    );
    renderPanel();

    expect(await screen.findByText("Environment variable DEEPSEEK_API_KEY is set")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "macOS Keychain" })).toBeDisabled();
    expect(screen.getByText("macOS Keychain is unavailable in this environment (macOS with a usable Keychain only).")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter the API key")).not.toBeInTheDocument();
  });

  it("tests the connection through the shared runtime action with a visible result", async () => {
    const user = userEvent.setup();
    const { promise, resolve } = Promise.withResolvers<{ ok: boolean; models: number; message: string }>();
    mocks.testProviderConnection.mockImplementation(() => promise);
    renderPanel();

    await screen.findByText("Environment variable DEEPSEEK_API_KEY is not set");
    const test = within(screen.getByRole("region", { name: "API key" })).getByRole("button", { name: "Test connection" });
    await user.click(test);
    expect(mocks.testProviderConnection).toHaveBeenCalledWith("deepseek");
    await waitFor(() => expect(test).toBeDisabled());

    resolve({ ok: true, models: 2, message: "Connected" });
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    await waitFor(() => expect(test).toBeEnabled());
  });
});
