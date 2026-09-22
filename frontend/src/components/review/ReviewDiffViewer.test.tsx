import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewDiffViewer } from "./ReviewDiffViewer";
import { parseUnifiedDiff, splitDiffRows } from "./diff";

const content = "@@ -1,1 +1,1 @@\n-old\n+new";
const lines = parseUnifiedDiff(content);
const rows = splitDiffRows(lines);

describe("ReviewDiffViewer", () => {
  it("renders unified and split diff content", () => {
    const { rerender } = render(
      <ReviewDiffViewer
        loading={false}
        binary={false}
        selectedPath="main.ts"
        mode="unified"
        lines={lines}
        rows={rows}
        language="typescript"
        loadingLabel="Loading"
        binaryLabel="Binary"
      />
    );
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();

    rerender(
      <ReviewDiffViewer
        loading={false}
        binary={false}
        selectedPath="main.ts"
        mode="split"
        lines={lines}
        rows={rows}
        language="typescript"
        loadingLabel="Loading"
        binaryLabel="Binary"
      />
    );
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("uses the binary empty state instead of rendering text lines", () => {
    render(
      <ReviewDiffViewer
        loading={false}
        binary
        selectedPath="asset.png"
        mode="unified"
        lines={[]}
        rows={[]}
        language="plaintext"
        loadingLabel="Loading"
        binaryLabel="Binary diff"
      />
    );
    expect(screen.getByText("Binary diff")).toBeInTheDocument();
    expect(screen.getByText("asset.png")).toBeInTheDocument();
  });
});
