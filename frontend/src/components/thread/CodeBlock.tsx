import { Check, Copy } from "lucide-react";
import { useState } from "react";

type Props = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="thread-code-block">
      <div className="thread-code-head">
        <span>{language || "text"}</span>
        <button type="button" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
        </button>
      </div>
      <pre><code data-language={language || "text"}>{code}</code></pre>
    </div>
  );
}
