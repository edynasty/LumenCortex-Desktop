import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigState, ProviderCatalogDocument, ProviderCatalogScope } from "../../types";
import { ProviderSettingsPanel } from "./ProviderSettingsPanel";

const mocks = vi.hoisted(() => ({
  providerCatalogScope: vi.fn(),
  saveProviderCatalogScope: vi.fn(),
  providerCredentialStatus: vi.fn(),
  saveProviderCredential: vi.fn(),
  removeProviderCredential: vi.fn(),
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

function fileDoc(digest: string, providers: ProviderCatalogDocument["catalog"]["providers"] = {}): ProviderCatalogDocument {
  return { scope: "global", path: "/home/.config/lumencortex/lumencortex.json", digest, catalog: { providers } };
}

function renderPanel(overrides: { workspace?: string; config?: ConfigState; onError?: (message: string) => void; onConfigChanged?: () => void; onTrust?: () => void } = {}) {
  return render(
    <ProviderSettingsPanel
      locale="en"
      workspace={overrides.workspace ?? ""}
      config={overrides.config ?? config}
      trusting={false}
      onTrust={overrides.onTrust ?? (() => undefined)}
      onConfigChanged={overrides.onConfigChanged ?? (() => undefined)}
      onError={overrides.onError ?? (() => undefined)}
    />
  );
}

describe("ProviderSettingsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.providerCatalogScope.mockReset();
    mocks.saveProviderCatalogScope.mockReset();
    mocks.providerCredentialStatus.mockReset();
    mocks.saveProviderCredential.mockReset();
    mocks.removeProviderCredential.mockReset();
    mocks.providerCatalogScope.mockResolvedValue(fileDoc("sha256:one"));
    mocks.providerCredentialStatus.mockResolvedValue({
      providerId: "deepseek",
      scope: "global",
      source: "none",
      set: false,
    });
  });
  it("hydrates a safe DeepSeek preset without exposing a literal secret field", async () => {
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "DeepSeek" }));

    expect(screen.getByDisplayValue("deepseek")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://api.deepseek.com/v1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DEEPSEEK_API_KEY")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/sk-/i)).not.toBeInTheDocument();
  });

  it("remembers the selected provider scope per workspace", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPanel({ workspace: "/repo/demo" });

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledWith("global"));
    await user.click(screen.getByRole("radio", { name: "Project" }));
    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledWith("workspace"));
    unmount();
    mocks.providerCatalogScope.mockClear();
    renderPanel({ workspace: "/repo/demo" });

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledWith("workspace"));
  });

  it("keeps provider scope memory isolated by workspace", async () => {
    localStorage.setItem("lcx-provider-scope:/repo/one", "workspace");
    renderPanel({ workspace: "/repo/two" });

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledWith("global"));
  });

  it("keeps project scope disabled until a workspace is open", async () => {
    renderPanel();

    expect(await screen.findByRole("radio", { name: "Project" })).toBeDisabled();
  });

  it("saves with the digest it read and adopts the digest Core returns", async () => {
    const user = userEvent.setup();
    const onConfigChanged = vi.fn();
    mocks.saveProviderCatalogScope.mockResolvedValue(fileDoc("sha256:two", { deepseek: { name: "deepseek", models: {} } }));
    renderPanel({ onConfigChanged });

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "DeepSeek" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.saveProviderCatalogScope).toHaveBeenCalledTimes(1));
    const [scope, sent] = mocks.saveProviderCatalogScope.mock.calls[0];
    expect(scope).toBe("global");
    expect(sent.digest).toBe("sha256:one");
    expect(Object.keys(sent.catalog.providers)).toEqual(["deepseek"]);
    expect(sent.catalog.providers.deepseek.settings.apiKey).toBe("{env:DEEPSEEK_API_KEY}");
    await waitFor(() => expect(onConfigChanged).toHaveBeenCalled());
  });

  it("reloads the file and reports the conflict when it changed on disk", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    mocks.saveProviderCatalogScope.mockRejectedValue(new Error("config file changed since it was read: /home/lumencortex.json"));
    renderPanel({ onError });

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledTimes(1));
    mocks.providerCatalogScope.mockResolvedValue(fileDoc("sha256:disk", { external: { name: "External", models: {} } }));
    await user.click(screen.getByRole("button", { name: "DeepSeek" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining("config file changed since it was read")));
    expect(mocks.providerCatalogScope).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("External")).toBeInTheDocument();
  });

  // The backend keeps fields the panel does not show (headers, timeouts, toolCalling) only if a
  // rename says which entry the new key replaces.
  it("marks a provider rename and a model rename with the key they replace", async () => {
    const user = userEvent.setup();
    mocks.providerCatalogScope.mockResolvedValue(fileDoc("sha256:one", { old: { name: "Old", models: { m: { name: "M" } } } }));
    mocks.saveProviderCatalogScope.mockImplementation(async (_scope, sent: ProviderCatalogDocument) => ({ ...sent, digest: "sha256:next" }));
    renderPanel();

    const [providerEdit] = await screen.findAllByRole("button", { name: "Edit" });
    await user.click(providerEdit);
    const providerId = screen.getByLabelText("Provider ID");
    await user.clear(providerId);
    await user.type(providerId, "new");
    await user.click(within(document.querySelector(".provider-form")!).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveProviderCatalogScope).toHaveBeenCalledTimes(1));
    const renamedProvider = mocks.saveProviderCatalogScope.mock.calls[0][1].catalog.providers;
    expect(Object.keys(renamedProvider)).toEqual(["new"]);
    expect(renamedProvider.new.renamedFrom).toBe("old");

    // The renamed provider is listed with its model; rename that model.
    const [, modelEdit] = await screen.findAllByRole("button", { name: "Edit" });
    await user.click(modelEdit);
    const modelId = screen.getByLabelText("Model ID");
    await user.clear(modelId);
    await user.type(modelId, "m2");
    await user.click(within(document.querySelector(".provider-model-form")!).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveProviderCatalogScope).toHaveBeenCalledTimes(2));
    const models = mocks.saveProviderCatalogScope.mock.calls[1][1].catalog.providers.new.models;
    expect(Object.keys(models)).toEqual(["m2"]);
    expect(models.m2.renamedFrom).toBe("m");
  });

  it("shows Core's configuration warnings and offers trust only when Core names the entry", async () => {
    const onTrust = vi.fn();
    const user = userEvent.setup();
    renderPanel({
      onTrust,
      config: {
        ...config,
        warnings: [
          { code: "untrusted_override", key: "providers.local", trustEntry: "/repo", trustFile: "/home/lumencortex.json", message: "m1" },
          { code: "untrusted_override", key: "checks.go-test", trustEntry: "/repo", trustFile: "/home/lumencortex.json", message: "m2" },
          { code: "default_limit", key: "a/b.context", message: "model a/b sets no context; using 32768" },
          { code: "future_code", message: "something Core reports that this build does not know" },
        ],
      },
    });

    expect(await screen.findByText("providers.local")).toBeInTheDocument();
    expect(screen.getByText("checks.go-test")).toBeInTheDocument();
    expect(screen.getByText("a/b.context is not set; the default is used.")).toBeInTheDocument();
    expect(screen.getByText("something Core reports that this build does not know")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Trust this project" }));
    expect(onTrust).toHaveBeenCalledTimes(1);
  });

  it("protocol change updates the base URL/endpoint hints and saves the selected package", async () => {
    const user = userEvent.setup();
    mocks.providerCatalogScope.mockResolvedValue(fileDoc("sha256:one", { old: { name: "Old", models: {} } }));
    mocks.saveProviderCatalogScope.mockResolvedValue(fileDoc("sha256:two", { old: { name: "Old", models: {} } }));
    renderPanel();

    // A provider written before packages existed displays as [OI] Compatible.
    const [providerEdit] = await screen.findAllByRole("button", { name: "Edit" });
    await user.click(providerEdit);
    const group = screen.getByRole("radiogroup", { name: "Protocol" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "[OI] Compatible" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/sends \/chat\/completions requests/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://api.deepseek.com/v1")).toBeInTheDocument();

    // Switching protocol swaps the hints for the Anthropic Messages defaults.
    await user.click(screen.getByRole("radio", { name: "Anthropic Messages" }));
    expect(screen.getByText(/sends \/v1\/messages requests with the key in an x-api-key header/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://api.anthropic.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://api.anthropic.com/v1/messages")).toBeInTheDocument();
    expect(screen.getByText("Defaults to baseURL + /v1/messages when empty.")).toBeInTheDocument();

    await user.click(within(document.querySelector(".provider-form")!).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveProviderCatalogScope).toHaveBeenCalledTimes(1));
    expect(mocks.saveProviderCatalogScope.mock.calls[0][1].catalog.providers.old.package).toBe("anthropic-messages");
  });

  it("saves a provider without a package unchanged until the user edits it", async () => {
    const user = userEvent.setup();
    mocks.providerCatalogScope.mockResolvedValue(
      fileDoc("sha256:one", { old: { name: "Old", models: { m: { name: "M" } } } }),
    );
    mocks.saveProviderCatalogScope.mockImplementation(async (_scope: ProviderCatalogScope, sent: ProviderCatalogDocument) => ({ ...sent, digest: "sha256:two" }));
    renderPanel();

    // Setting a default model saves the catalog without touching the provider entry.
    await screen.findByRole("button", { name: "Old old · 1 models" });
    await user.click(screen.getByRole("button", { name: "Set default" }));
    await waitFor(() => expect(mocks.saveProviderCatalogScope).toHaveBeenCalledTimes(1));
    const saved = mocks.saveProviderCatalogScope.mock.calls[0][1].catalog.providers.old;
    expect(saved.package).toBeUndefined();
    expect(saved.settings?.apiKey).toBeUndefined();
  });

  it("refuses a literal key pasted into the env-name field", async () => {
    const user = userEvent.setup();
    mocks.providerCatalogScope.mockResolvedValue(fileDoc("sha256:one", { deepseek: { name: "DeepSeek", models: {} } }));
    renderPanel();

    const [providerEdit] = await screen.findAllByRole("button", { name: "Edit" });
    await user.click(providerEdit);
    const envField = screen.getByLabelText(/API key environment variable/);
    await user.clear(envField);
    await user.type(envField, "sk-live-NEVER-PRINT-9876543210");

    expect(within(document.querySelector(".provider-form")!).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText(/may only contain letters, digits and underscores/)).toBeInTheDocument();
    expect(envField).toHaveAttribute("aria-invalid", "true");
    expect(mocks.saveProviderCatalogScope).not.toHaveBeenCalled();
  });
});
