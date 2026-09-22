import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderSettingsPanel } from "./ProviderSettingsPanel";

const mocks = vi.hoisted(() => ({
  providerCatalogScope: vi.fn(),
  providerCatalog: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: {
    providerCatalogScope: mocks.providerCatalogScope,
    providerCatalog: mocks.providerCatalog,
    saveProviderCatalogScope: vi.fn(),
    testProviderConnection: vi.fn(),
    discoverProviderModels: vi.fn(),
  },
}));

describe("ProviderSettingsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.providerCatalogScope.mockReset();
    mocks.providerCatalog.mockReset();
    mocks.providerCatalogScope.mockResolvedValue({ providers: {} });
    mocks.providerCatalog.mockResolvedValue({ providers: {} });
  });

  it("hydrates a safe DeepSeek preset without exposing a literal secret field", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSettingsPanel
        locale="en"
        workspace=""
        effectiveCatalog={{ providers: {} }}
        selectedModelRef=""
        onSelectedModelRef={() => undefined}
        onEffectiveCatalogChange={() => undefined}
        onError={() => undefined}
      />
    );

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "DeepSeek" }));

    expect(screen.getByDisplayValue("deepseek")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://api.deepseek.com/v1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DEEPSEEK_API_KEY")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/sk-/i)).not.toBeInTheDocument();
  });

  it("remembers the selected provider scope per workspace", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ProviderSettingsPanel
        locale="en"
        workspace="/repo/demo"
        effectiveCatalog={{ providers: {} }}
        selectedModelRef=""
        onSelectedModelRef={() => undefined}
        onEffectiveCatalogChange={() => undefined}
        onError={() => undefined}
      />
    );

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledWith("global"));
    await user.click(screen.getByRole("button", { name: /Project.*Overrides this project only/i }));
    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledWith("workspace"));
    unmount();

    mocks.providerCatalogScope.mockClear();
    render(
      <ProviderSettingsPanel
        locale="en"
        workspace="/repo/demo"
        effectiveCatalog={{ providers: {} }}
        selectedModelRef=""
        onSelectedModelRef={() => undefined}
        onEffectiveCatalogChange={() => undefined}
        onError={() => undefined}
      />
    );

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledWith("workspace"));
  });

  it("keeps provider scope memory isolated by workspace", async () => {
    localStorage.setItem("lcx-provider-scope:/repo/one", "workspace");
    render(
      <ProviderSettingsPanel
        locale="en"
        workspace="/repo/two"
        effectiveCatalog={{ providers: {} }}
        selectedModelRef=""
        onSelectedModelRef={() => undefined}
        onEffectiveCatalogChange={() => undefined}
        onError={() => undefined}
      />
    );

    await waitFor(() => expect(mocks.providerCatalogScope).toHaveBeenCalledWith("global"));
  });

  it("keeps project scope disabled until a workspace is open", async () => {
    render(
      <ProviderSettingsPanel
        locale="en"
        workspace=""
        effectiveCatalog={{ providers: {} }}
        selectedModelRef=""
        onSelectedModelRef={() => undefined}
        onEffectiveCatalogChange={() => undefined}
        onError={() => undefined}
      />
    );

    expect(await screen.findByRole("button", { name: /Project.*Overrides this project only/i })).toBeDisabled();
  });
});
