import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../lib/i18n/app-copy";
import { WorkspaceOverlays } from "./WorkspaceOverlays";

describe("WorkspaceOverlays", () => {
  it("renders and invokes an error recovery action", async () => {
    const user = userEvent.setup();
    const onErrorAction = vi.fn();
    const onClearError = vi.fn();

    render(
      <WorkspaceOverlays
        cleanupOpen={false}
        busy={false}
        error="provider model not found"
        labels={copy.en}
        onCleanupOpenChange={() => undefined}
        onCleanup={() => undefined}
        errorActionLabel="Provider configuration"
        onErrorAction={onErrorAction}
        onClearError={onClearError}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("provider model not found");
    await user.click(screen.getByRole("button", { name: "Provider configuration" }));
    expect(onErrorAction).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClearError).toHaveBeenCalledTimes(1);
  });
});
