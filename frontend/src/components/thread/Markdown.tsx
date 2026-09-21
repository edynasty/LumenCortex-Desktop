import type { ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

type Props = { text: string };

function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code className="thread-inline-code" key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function Markdown({ text }: Props) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    const value = paragraph.join(" ").trim();
    if (value) nodes.push(<p key={`p-${nodes.length}`}>{inline(value)}</p>);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`}>
        {list.map((item, index) => <li key={index}>{inline(item)}</li>)}
      </ul>
    );
    list = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      const language = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      nodes.push(<CodeBlock key={`code-${nodes.length}`} code={code.join("\n")} language={language} />);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(4, heading[1].length);
      const Tag = (`h${level}` as keyof JSX.IntrinsicElements);
      nodes.push(<Tag key={`h-${nodes.length}`}>{inline(heading[2])}</Tag>);
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  return <div className="thread-markdown">{nodes}</div>;
}
