import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigState, ProviderCatalogDocument } from "../../types";
import { ProviderSettingsPanel } from "./ProviderSettingsPanel";

const mocks = vi.hoisted(() => ({
  providerCatalogScope: vi.fn(),
  saveProviderCatalogScope: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: {
    providerCatalogScope: mocks.providerCatalogScope,
    saveProviderCatalogScope: mocks.saveProviderCatalogScope,
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
    mocks.providerCatalogScope.mockResolvedValue(fileDoc("sha256:one"));
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
    await user.click(screen.getByRole("button", { name: /Project.*Overrides this project only/i }));
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

    expect(await screen.findByRole("button", { name: /Project.*Overrides this project only/i })).toBeDisabled();
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
});
