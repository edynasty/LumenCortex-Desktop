import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderSettingsPanel } from "./ProviderSettingsPanel";

const providerCatalogScope = vi.fn();
const providerCatalog = vi.fn();

vi.mock("../../lib/bridge", () => ({
  bridge: {
    providerCatalogScope,
    providerCatalog,
    saveProviderCatalogScope: vi.fn(),
    testProviderConnection: vi.fn(),
    discoverProviderModels: vi.fn(),
  },
}));

describe("ProviderSettingsPanel", () => {
  beforeEach(() => {
    providerCatalogScope.mockReset();
    providerCatalog.mockReset();
    providerCatalogScope.mockResolvedValue({ providers: {} });
    providerCatalog.mockResolvedValue({ providers: {} });
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

    await waitFor(() => expect(providerCatalogScope).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "DeepSeek" }));

    expect(screen.getByDisplayValue("deepseek")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://api.deepseek.com/v1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("DEEPSEEK_API_KEY")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/sk-/i)).not.toBeInTheDocument();
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

    expect(await screen.findByRole("button", { name: /Project/i })).toBeDisabled();
  });
});
