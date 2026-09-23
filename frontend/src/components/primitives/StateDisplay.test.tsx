import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

describe("shared state displays", () => {
  it("renders compact empty state copy", () => {
    const { container } = render(<EmptyState compact title="Nothing here" body="Try another filter." />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Try another filter.")).toBeInTheDocument();
    expect(container.querySelector(".desktop-empty-state")).toHaveClass("compact");
  });

  it("exposes loading state through status semantics", () => {
    const { container } = render(<LoadingState compact label="Loading changes" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading changes");
    expect(container.querySelector(".desktop-loading-state")).toHaveClass("compact");
  });
});
