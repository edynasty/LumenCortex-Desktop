import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { normalizeLanguage } from "../../lib/syntax";
import { SyntaxLine } from "../code/SyntaxLine";

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

  const normalizedLanguage = normalizeLanguage(language);

  return (
    <div className="thread-code-block">
      <div className="thread-code-head">
        <span>{normalizedLanguage}</span>
        <button type="button" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
        </button>
      </div>
      <pre><code data-language={normalizedLanguage}>
        {code.replace(/\r\n/g, "\n").split("\n").map((line, index) => (
          <span className="thread-code-line" key={index}>
            <SyntaxLine text={line} language={normalizedLanguage} />
            {"\n"}
          </span>
        ))}
      </code></pre>
    </div>
  );
}
