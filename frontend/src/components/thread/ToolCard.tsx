import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  title: string;
  content: string;
};

type ToolMetadata = {
  summary: string;
  tags: string[];
  failed: boolean;
};

function metadata(content: string): ToolMetadata {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const tags: string[] = [];
    const path = typeof parsed.path === "string" ? parsed.path : "";
    const command = typeof parsed.command === "string" ? parsed.command : "";
    const error = typeof parsed.error === "string" ? parsed.error : "";
    const exitCode = typeof parsed.exitCode === "number" ? parsed.exitCode : undefined;
    const truncated = parsed.truncated === true ||
      (parsed.stdout && typeof parsed.stdout === "object" && (parsed.stdout as Record<string, unknown>).truncated === true) ||
      (parsed.stderr && typeof parsed.stderr === "object" && (parsed.stderr as Record<string, unknown>).truncated === true);

    if (path) tags.push(path);
    if (exitCode !== undefined) tags.push(`exit ${exitCode}`);
    if (truncated) tags.push("truncated");

    return {
      summary: path || command || error || content,
      tags,
      failed: Boolean(error) || (exitCode !== undefined && exitCode !== 0) || parsed.ok === false,
    };
  } catch {
    return { summary: content, tags: [], failed: false };
  }
}

export function ToolCard({ title, content }: Props) {
  const [open, setOpen] = useState(false);
  const meta = useMemo(() => metadata(content), [content]);

  return (
    <div className={`thread-tool-card ${meta.failed ? "failed" : ""}`}>
      <button type="button" className="thread-tool-summary" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
        <Wrench size={13} strokeWidth={1.7} aria-hidden />
        <strong>{title}</strong>
        <span>{meta.summary.slice(0, 120)}</span>
      </button>
      {meta.tags.length > 0 && (
        <div className="thread-tool-meta">
          {meta.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}
      {open && <pre className="thread-tool-output">{content}</pre>}
    </div>
  );
}
