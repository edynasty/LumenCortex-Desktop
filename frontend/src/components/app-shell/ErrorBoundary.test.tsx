import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("Array.from requires an array-like object");
}

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("replaces a crashed render with the message and a reload instead of a blank window", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Array.from requires an array-like object");
    expect(screen.getByRole("button")).toBeVisible();
  });

  it("renders children untouched when nothing fails", () => {
    render(<ErrorBoundary><p>fine</p></ErrorBoundary>);
    expect(screen.getByText("fine")).toBeVisible();
  });
});
