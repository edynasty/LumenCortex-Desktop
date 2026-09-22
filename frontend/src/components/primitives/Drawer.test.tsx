import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Drawer } from "./Drawer";

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open drawer</button>
      <Drawer
        open={open}
        label="Settings"
        closeLabel="Close settings"
        onOpenChange={setOpen}
      >
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Drawer>
    </>
  );
}

describe("Drawer", () => {
  it("traps focus, closes on Escape, and restores the opener", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);

    const opener = screen.getByRole("button", { name: "Open drawer" });
    await user.click(opener);

    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });
    expect(first).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Settings" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
