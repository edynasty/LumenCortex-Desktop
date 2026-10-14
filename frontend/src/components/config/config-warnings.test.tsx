import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import { ConfigWarnings } from "./ConfigWarnings";
import { viewWarnings } from "./config-warnings";

describe("configuration warnings", () => {
  it("renders every known code from centralized copy and unknown codes by Core's message", () => {
    const view = viewWarnings(copy.en, [
      { code: "legacy_global_path", path: "/old/lumencortex.json", moveTo: "/new/lumencortex.json", message: "m" },
      { code: "cognition_profile", path: "/repo/.lumencortex/cognition.json", message: "m" },
      { code: "default_limit", key: "a/b.output", message: "m" },
      { code: "from_the_future", message: "Core says hello" },
    ]);
    expect(view.lines).toEqual([
      "Found /old/lumencortex.json in a legacy location; it is not read. Move it to /new/lumencortex.json.",
      "Found /repo/.lumencortex/cognition.json. Its provider, category and health settings are ignored; configure models in lumencortex.json.",
      "a/b.output is not set; the default is used.",
      "Core says hello",
    ]);
    expect(viewWarnings(copy.en, [{ code: "default_limit", key: "a/b.output", message: "m" }], true).lines).toEqual([]);
  });

  it("collapses dropped entries into one trust prompt", () => {
    const view = viewWarnings(copy.en, [
      { code: "untrusted_override", key: "providers.p", trustEntry: "/repo", message: "m" },
      { code: "untrusted_override", key: "providers.p", trustEntry: "/repo", message: "m" },
      { code: "untrusted_override", key: "checks.t", trustEntry: "/repo", message: "m" },
    ]);
    expect(view.untrustedKeys).toEqual(["providers.p", "checks.t"]);
    expect(view.trustable).toBe(true);
  });

  it("does not offer trust for the global-file notice that has no trust entry", () => {
    const view = viewWarnings(copy.en, [{ code: "untrusted_override", key: "trustedWorkspaces", message: "m" }]);
    expect(view.trustable).toBe(false);
  });

  it("renders nothing without warnings and disables trust while saving", async () => {
    const { container, rerender } = render(<ConfigWarnings labels={copy.en} warnings={[]} trusting={false} onTrust={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();

    const onTrust = vi.fn();
    rerender(
      <ConfigWarnings
        labels={copy["zh-CN"]}
        warnings={[{ code: "untrusted_override", key: "providers.p", trustEntry: "/repo", message: "m" }]}
        trusting={false}
        onTrust={onTrust}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: copy["zh-CN"].configTrustWorkspace }));
    expect(onTrust).toHaveBeenCalledTimes(1);

    rerender(
      <ConfigWarnings
        labels={copy["zh-CN"]}
        warnings={[{ code: "untrusted_override", key: "providers.p", trustEntry: "/repo", message: "m" }]}
        trusting
        onTrust={onTrust}
      />,
    );
    expect(screen.getByRole("button", { name: copy["zh-CN"].configTrusting })).toBeDisabled();
  });
});
