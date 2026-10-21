import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Dialog } from "./Dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open}
        title="Delete provider"
        description="This cannot be undone."
        closeLabel="Dismiss"
        onOpenChange={setOpen}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button">Delete</button>
          </>
        }
      />
    </>
  );
}

describe("Dialog", () => {
  it("traps focus, closes on Escape, and restores the opener", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    const opener = screen.getByRole("button", { name: "Open dialog" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Delete provider" });
    const close = screen.getByRole("button", { name: "Dismiss" });
    const deleteButton = screen.getByRole("button", { name: "Delete" });

    expect(dialog).toBeVisible();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(deleteButton).toHaveFocus();

    await user.keyboard("{Escape}");
    // Focus returns the moment the dialog is dismissed; the layer unmounts after its exit.
    expect(opener).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("is inert during its exit, keeps its content, and reopening cancels the unmount", async () => {
    const { rerender } = render(<Dialog open title="Delete provider" description="Gone for good." onOpenChange={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Delete provider" })).toBeVisible();

    // The parent clears everything it passed (as a parent does when it drops its target).
    rerender(<Dialog open={false} title="" onOpenChange={() => {}} />);
    const layer = screen.getByRole("dialog", { hidden: true }).parentElement!;
    expect(layer).toHaveAttribute("data-state", "closed");
    expect(layer).toHaveAttribute("inert");
    expect(screen.getByText("Gone for good.")).toBeInTheDocument();

    // Reopen before the exit ends: the same layer returns, no longer inert.
    rerender(<Dialog open title="Delete provider" description="Gone for good." onOpenChange={() => {}} />);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByRole("dialog", { name: "Delete provider" })).toBeVisible();
    expect(screen.getByRole("dialog").parentElement).not.toHaveAttribute("inert");
    expect(screen.getByRole("dialog").parentElement).toHaveAttribute("data-state", "open");
  });
});
