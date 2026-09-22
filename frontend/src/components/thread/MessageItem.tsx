import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyText } from "../../lib/clipboard";
import type { Message } from "../../types";
import { Markdown } from "./Markdown";
import { ToolCard } from "./ToolCard";

type Labels = {
  roleUser: string;
  roleAssistant: string;
  roleTool: string;
  roleSystem: string;
  copy: string;
  copied: string;
};

type Props = {
  message: Message;
  labels: Labels;
};

function normalizePayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return { content: value };
    }
  }
  return {};
}

function roleClass(role: string) {
  if (role === "assistant") return "assistant";
  if (role === "tool") return "tool";
  if (role === "system") return "system";
  return "user";
}

export function MessageItem({ message, labels }: Props) {
  const [copied, setCopied] = useState(false);
  const payload = normalizePayload(message.json);
  const content = typeof payload.content === "string" ? payload.content : JSON.stringify(payload, null, 2);
  const roleLabel =
    message.role === "assistant" ? labels.roleAssistant :
    message.role === "tool" ? labels.roleTool :
    message.role === "system" ? labels.roleSystem :
    labels.roleUser;
  const avatar =
    message.role === "assistant" ? "LC" :
    message.role === "tool" ? "T" :
    message.role === "system" ? "S" : "U";

  return (
    <article className={`message-row ${roleClass(message.role)}`}>
      <div className="message-avatar">{avatar}</div>
      <div className="message-body">
        <div className="message-head">
          <strong>{roleLabel}</strong>
          <div className="message-head-actions">
            <span>#{message.seq}</span>
            {message.role !== "tool" && content && (
              <button
                type="button"
                aria-label={copied ? labels.copied : labels.copy}
                title={copied ? labels.copied : labels.copy}
                onClick={async () => {
                  if (await copyText(content)) {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  }
                }}
              >
                {copied ? <Check size={11} strokeWidth={1.8} aria-hidden /> : <Copy size={11} strokeWidth={1.7} aria-hidden />}
              </button>
            )}
          </div>
        </div>
        {message.role === "tool"
          ? <ToolCard title={typeof payload.name === "string" ? payload.name : labels.roleTool} content={content} />
          : <Markdown text={content || "(empty message)"} />}
      </div>
    </article>
  );
}
