import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ReviewDiffViewer } from "./ReviewDiffViewer";
import { parseUnifiedDiff, splitDiffRows } from "./diff";

const content = "@@ -1,1 +1,1 @@\n-old\n+new";
const lines = parseUnifiedDiff(content);
const rows = splitDiffRows(lines);

function renderViewer(overrides: Partial<React.ComponentProps<typeof ReviewDiffViewer>> = {}) {
  return render(
    <ReviewDiffViewer
      loading={false}
      binary={false}
      selectedPath="main.ts"
      contentKey="main.ts:worktree:1"
      mode="unified"
      lines={lines}
      rows={rows}
      language="typescript"
      loadingLabel="Loading"
      binaryLabel="Binary"
      loadMoreLabel="Load more diff"
      {...overrides}
    />
  );
}

describe("ReviewDiffViewer", () => {
  it("renders unified and split diff content", () => {
    const { rerender } = renderViewer();
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();

    rerender(
      <ReviewDiffViewer
        loading={false}
        binary={false}
        selectedPath="main.ts"
        contentKey="main.ts:worktree:1"
        mode="split"
        lines={lines}
        rows={rows}
        language="typescript"
        loadingLabel="Loading"
        binaryLabel="Binary"
        loadMoreLabel="Load more diff"
      />
    );
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("uses the binary empty state instead of rendering text lines", () => {
    renderViewer({
      binary: true,
      selectedPath: "asset.png",
      contentKey: "asset.png:worktree:1",
      lines: [],
      rows: [],
      language: "plaintext",
      binaryLabel: "Binary diff",
    });
    expect(screen.getByText("Binary diff")).toBeInTheDocument();
    expect(screen.getByText("asset.png")).toBeInTheDocument();
  });

  it("renders large diffs in bounded chunks", async () => {
    const user = userEvent.setup();
    const largeContent = [
      "@@ -1,0 +1,300 @@",
      ...Array.from({ length: 300 }, (_, index) => `+line-${index + 1}`),
    ].join("\n");
    const largeLines = parseUnifiedDiff(largeContent);

    renderViewer({
      contentKey: "large.ts:worktree:1",
      lines: largeLines,
      rows: splitDiffRows(largeLines),
    });

    expect(screen.getByText("line-1")).toBeInTheDocument();
    expect(screen.queryByText("line-300")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more diff" }));

    expect(screen.getByText("line-300")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more diff" })).not.toBeInTheDocument();
  });
});
