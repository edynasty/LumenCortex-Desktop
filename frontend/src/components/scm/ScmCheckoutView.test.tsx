import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import { ScmCheckoutView } from "./ScmCheckoutView";

vi.mock("./ScmChangesView", () => ({ ScmChangesView: () => null }));
vi.mock("./ScmBranchGraph", () => ({ ScmBranchGraph: () => null }));

const labels = copy.en;
const props = { workspace: "/w", worktrees: [], baseBranch: "main", revision: 0, labels, onSelectCheckout: () => undefined };

describe("ScmCheckoutView state cell", () => {
  it("says it is loading until the change count is read, then clean or dirty", () => {
    const { rerender } = render(<ScmCheckoutView {...props} changeCount={undefined} />);
    expect(screen.getByRole("status")).toHaveTextContent(labels.loading);
    expect(screen.queryByText(labels.scmTargetClean)).not.toBeInTheDocument();

    rerender(<ScmCheckoutView {...props} changeCount={0} />);
    expect(screen.getByText(labels.scmTargetClean)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<ScmCheckoutView {...props} changeCount={3} />);
    expect(screen.getByText(labels.scmTargetDirty)).toBeInTheDocument();
  });

  it("stops saying loading when Core could not read the status", () => {
    render(<ScmCheckoutView {...props} changeCount={null} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(labels.unknown)).toBeInTheDocument();
  });
});
