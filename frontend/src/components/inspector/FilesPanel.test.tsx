import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { DirListing } from "../../types";
import { FilesPanel } from "./FilesPanel";

const mocks = vi.hoisted(() => ({
  listDir: vi.fn(),
  revealInFinder: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels = copy.en;

const root: DirListing = {
  path: "",
  truncated: false,
  entries: [
    { name: "src", path: "src", kind: "dir", size: 64 },
    { name: "docs", path: "docs", kind: "dir", size: 64 },
    { name: ".env", path: ".env", kind: "file", size: 12 },
    { name: "README.md", path: "README.md", kind: "file", size: 120 },
  ],
};

const src: DirListing = {
  path: "src",
  truncated: false,
  entries: [
    { name: "nested", path: "src/nested", kind: "dir", size: 64 },
    { name: "App.tsx", path: "src/App.tsx", kind: "file", size: 900 },
  ],
};

const nested: DirListing = {
  path: "src/nested",
  truncated: false,
  entries: [{ name: "deep.ts", path: "src/nested/deep.ts", kind: "file", size: 40 }],
};

function panel() {
  return <FilesPanel workspace="/Users/demo/project" workspaceOpen labels={labels} />;
}

function rowNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".file-row-name")).map((node) => node.textContent ?? "");
}

describe("FilesPanel", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === "src") return src;
      if (path === "src/nested") return nested;
      if (path === "docs") return { path: "docs", entries: [], truncated: false };
      return root;
    });
    mocks.revealInFinder.mockResolvedValue(undefined);
  });

  it("shows Core's order, including dotfiles, and expands a directory one level at a time", async () => {
    const { container } = render(panel());
    await screen.findByText("README.md");
    // Core orders directories first, then names case-insensitively.
    expect(rowNames(container)).toEqual(["src", "docs", ".env", "README.md"]);
    expect(mocks.listDir).toHaveBeenCalledWith("");

    await userEvent.click(screen.getByRole("button", { name: /src/ }));
    await screen.findByText("App.tsx");
    expect(mocks.listDir).toHaveBeenCalledWith("src");
    expect(rowNames(container)).toEqual(["src", "nested", "App.tsx", "docs", ".env", "README.md"]);

    await userEvent.click(screen.getByRole("button", { name: /nested/ }));
    await screen.findByText("deep.ts");
    expect(mocks.listDir).toHaveBeenCalledWith("src/nested");

    // Collapsing the root directory hides its children and keeps them cached.
    await userEvent.click(screen.getByRole("button", { name: /src/ }));
    await waitFor(() => expect(screen.queryByText("App.tsx")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /src/ }));
    await screen.findByText("App.tsx");
    expect(mocks.listDir).toHaveBeenCalledTimes(3);
  });

  it("copies the workspace-relative path and confirms it on the row", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(panel());
    await screen.findByText("README.md");

    const row = screen.getByText("README.md").closest(".file-row") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: labels.filesCopyPath }));

    expect(writeText).toHaveBeenCalledWith("README.md");
    await waitFor(() => expect(within(row).getByRole("button", { name: labels.filesCopied })).toBeInTheDocument());
  });

  it("reveals a row in the Finder through the bridge", async () => {
    render(panel());
    await screen.findByText("README.md");
    const row = screen.getByText("README.md").closest(".file-row") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: labels.filesReveal }));
    expect(mocks.revealInFinder).toHaveBeenCalledWith("README.md");
  });

  it("says when Core truncated the listing", async () => {
    mocks.listDir.mockResolvedValue({ ...root, truncated: true });
    render(panel());
    expect(await screen.findByText(labels.filesTruncated)).toBeInTheDocument();
  });

  it("refreshes the root and every open branch", async () => {
    render(panel());
    await screen.findByText("README.md");
    await userEvent.click(screen.getByRole("button", { name: /src/ }));
    await screen.findByText("App.tsx");
    const before = mocks.listDir.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: labels.filesRefresh }));
    await waitFor(() => expect(mocks.listDir.mock.calls.length).toBeGreaterThan(before));
    expect(mocks.listDir).toHaveBeenCalledWith("");
    expect(mocks.listDir).toHaveBeenCalledWith("src");
  });

  it("shows a failed directory instead of an empty one", async () => {
    mocks.listDir.mockRejectedValue(new Error("permission denied"));
    render(panel());
    expect(await screen.findByText(`${labels.filesError}: permission denied`)).toBeInTheDocument();
  });

  it("asks for a project when none is open", () => {
    render(<FilesPanel workspace="" workspaceOpen={false} labels={labels} />);
    expect(screen.getByText(labels.filesNoWorkspace)).toBeInTheDocument();
    expect(mocks.listDir).not.toHaveBeenCalled();
  });
});
