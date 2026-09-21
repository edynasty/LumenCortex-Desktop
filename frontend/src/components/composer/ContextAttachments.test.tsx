import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContextAttachments } from "./ContextAttachments";

describe("ContextAttachments", () => {
  it("opens the picker menu and removes attached paths", async () => {
    const user = userEvent.setup();
    const pickFiles = vi.fn();
    const pickFolder = vi.fn();
    const remove = vi.fn();

    render(
      <ContextAttachments
        paths={["src/main.go"]}
        labels={{
          context: "Context",
          files: "Attach files",
          folder: "Attach folder",
          remove: "Remove context",
        }}
        onPickFiles={pickFiles}
        onPickFolder={pickFolder}
        onRemove={remove}
      />
    );

    await user.click(screen.getByRole("button", { name: "Context" }));
    await user.click(screen.getByRole("button", { name: "Attach files" }));
    expect(pickFiles).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Remove context: src/main.go" }));
    expect(remove).toHaveBeenCalledWith("src/main.go");

    await user.click(screen.getByRole("button", { name: "Context" }));
    await user.click(screen.getByRole("button", { name: "Attach folder" }));
    expect(pickFolder).toHaveBeenCalledTimes(1);
  });
});
