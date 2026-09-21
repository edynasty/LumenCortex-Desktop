import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { useState } from "react";

type Props = {
  title: string;
  content: string;
};

export function ToolCard({ title, content }: Props) {
  const [open, setOpen] = useState(false);
  let summary = content;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    summary =
      typeof parsed.path === "string" ? parsed.path :
      typeof parsed.command === "string" ? parsed.command :
      typeof parsed.error === "string" ? parsed.error :
      content;
  } catch {
    // Keep text summary.
  }

  return (
    <div className="thread-tool-card">
      <button type="button" className="thread-tool-summary" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
        <Wrench size={13} strokeWidth={1.7} aria-hidden />
        <strong>{title}</strong>
        <span>{summary.slice(0, 120)}</span>
      </button>
      {open && <pre className="thread-tool-output">{content}</pre>}
    </div>
  );
}
