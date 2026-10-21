import { useState } from "react";
import { copyText } from "../../lib/clipboard";
import { runtimeNotice, type RuntimeNoticeCopy } from "../../lib/runtime-notice";
import type { Message } from "../../types";
import { Icon } from "../primitives/Icon";
import { Markdown } from "./Markdown";
import { WorkGroup } from "./WorkGroup";
import { RememberButton, RememberEditor, type RememberLabels, type RememberNote } from "./RememberAction";

type AppCopyKeys = {
  workTitle: string;
  workCalls: string;
  showOutput: string;
  hideOutput: string;
};

type Labels = {
  roleUser: string;
  roleAssistant: string;
  roleTool: string;
  roleSystem: string;
  copy: string;
  copied: string;
  runtimeNotice: string;
} & RuntimeNoticeCopy &
  AppCopyKeys &
  RememberLabels;

type Props = {
  message: Message;
  labels: Labels;
  // Offered on the user's and the assistant's turns when the thread can take notes.
  onRemember?: RememberNote;
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

function CopyAction({ text, labels }: { text: string; labels: Pick<Labels, "copy" | "copied"> }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="msg-action"
      aria-label={copied ? labels.copied : labels.copy}
      title={copied ? labels.copied : labels.copy}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }
      }}
    >
      <Icon name={copied ? "checkmark" : "copy"} size={12} />
    </button>
  );
}

export function MessageItem({ message, labels, onRemember }: Props) {
  const [noting, setNoting] = useState(false);
  const [saved, setSaved] = useState(false);
  const payload = normalizePayload(message.json);
  const content = typeof payload.content === "string" ? payload.content : JSON.stringify(payload, null, 2);
  const origin = typeof payload.origin === "string" ? payload.origin : "";
  const canRemember = Boolean(onRemember && content.trim());
  const rememberButton = canRemember && <RememberButton saved={saved} labels={labels} onOpen={() => setNoting(true)} />;
  const rememberEditor = canRemember && noting && onRemember && (
    <RememberEditor
      text={content}
      labels={labels}
      onRemember={onRemember}
      onClose={(stored) => {
        setNoting(false);
        if (!stored) return;
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
      }}
    />
  );

  // Rows the runtime wrote are notices, not turns: a quiet line keyed by origin.
  if (origin) {
    const notice = runtimeNotice(labels, origin, content);
    const tone = origin === "tool_interrupted" || origin === "completion_blocked" ? "warn" : "info";
    return (
      <div
        className={`notice-line tone-${tone}`}
        role="note"
        aria-label={`${labels.runtimeNotice}: ${notice.title}`}
      >
        <Icon name={tone === "warn" ? "interrupted" : "history"} size={14} />
        <span className="notice-line-body">
          <strong>{notice.title}</strong>
          {notice.body && <p>{notice.body}</p>}
        </span>
      </div>
    );
  }

  if (message.role === "tool") {
    return <WorkGroup messages={[message]} labels={labels} />;
  }

  // An assistant row that only calls tools has no text: its calls show in the work group that follows.
  if (message.role === "assistant" && typeof payload.content !== "string" && Array.isArray(payload.tool_calls)) {
    return null;
  }

  if (message.role === "user") {
    return (
      <div className="msg-user" aria-label={labels.roleUser}>
        <div className="msg-user-bubble">
          {content}
          <CopyAction text={content} labels={labels} />
        </div>
        {rememberButton && <div className="msg-actions">{rememberButton}</div>}
        {rememberEditor}
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="msg-system" role="note" aria-label={labels.roleSystem}>
        <Markdown text={content || "(empty message)"} />
      </div>
    );
  }

  return (
    <div className="msg-assistant" aria-label={labels.roleAssistant}>
      <Markdown text={content || "(empty message)"} />
      {content && (
        <div className="msg-actions">
          <CopyAction text={content} labels={labels} />
          {rememberButton}
        </div>
      )}
      {rememberEditor}
    </div>
  );
}
