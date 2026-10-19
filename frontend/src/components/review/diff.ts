export type DiffLineKind = "meta" | "context" | "add" | "delete";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
  oldLine?: number;
  newLine?: number;
};

export type SplitRow = {
  left?: DiffLine;
  right?: DiffLine;
};

/**
 * Parses one file's unified diff into rows. The file header before the first hunk (`diff --git`,
 * `index`, `---`/`+++`, mode lines) is dropped: the diff head bar already names the file. Hunk
 * headers and in-hunk notes such as "\ No newline at end of file" stay as meta rows.
 */
export function parseUnifiedDiff(content: string): DiffLine[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const out: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const text of lines) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      inHunk = true;
      out.push({ kind: "meta", text });
      continue;
    }
    if (/^diff --git /.test(text)) {
      inHunk = false;
      continue;
    }
    // Outside a hunk every line is file header; inside one, the first column alone decides,
    // so a removed line that itself starts with "--" is still a deletion.
    if (!inHunk) continue;
    if (text.startsWith("+")) {
      out.push({ kind: "add", text: text.slice(1), newLine });
      newLine++;
      continue;
    }
    if (text.startsWith("-")) {
      out.push({ kind: "delete", text: text.slice(1), oldLine });
      oldLine++;
      continue;
    }
    if (text.startsWith(" ")) {
      out.push({ kind: "context", text: text.slice(1), oldLine, newLine });
      oldLine++;
      newLine++;
      continue;
    }
    if (text.startsWith("\\")) out.push({ kind: "meta", text });
  }
  return out;
}

export function splitDiffRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.kind === "delete") {
      const next = lines[i + 1];
      if (next?.kind === "add") {
        rows.push({ left: line, right: next });
        i++;
      } else {
        rows.push({ left: line });
      }
    } else if (line.kind === "add") {
      rows.push({ right: line });
    } else {
      rows.push({ left: line, right: line });
    }
  }
  return rows;
}

export function diffStats(lines: DiffLine[]) {
  return lines.reduce(
    (stats, line) => {
      if (line.kind === "add") stats.additions++;
      if (line.kind === "delete") stats.deletions++;
      return stats;
    },
    { additions: 0, deletions: 0 }
  );
}
