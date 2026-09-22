import { useState } from "react";
import { render, screen } from "@testing-library/react";
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
