import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  Ref,
} from "react";
import { ArrowUp, CircleCheck, Folder } from "lucide-react";
import type { Message, Session } from "../../types";
import { DesktopSelect, type SelectOption } from "../primitives/Select";

type Props = {
  session: Session;
  messages: Message[];
  running: boolean;
  statusLabel: string;
  workspaceName: string;
  modelRef: string;
  models: SelectOption[];
  policyLabel: string;
  goal: string;
  busy: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  labels: {
    newTask: string;
    running: string;
    noMessages: string;
    finalAnswer: string;
    startAnother: string;
    composerPlaceholder: string;
    composerHint: string;
    noModels: string;
    start: string;
    roleUser: string;
    roleAssistant: string;
    roleTool: string;
    roleSystem: string;
  };
  onGoalChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

function normalizePayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { content: value };
    }
  }
  return {};
}

function messageText(message: Message) {
  const payload = normalizePayload(message.json);
  if (typeof payload.content === "string" && payload.content.trim()) return payload.content;
  if (Array.isArray(payload.tool_calls)) {
    const names = payload.tool_calls
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const call = item as Record<string, unknown>;
        return typeof call.name === "string" ? call.name : "";
      })
      .filter(Boolean);
    if (names.length) return `Tool calls: ${names.join(", ")}`;
  }
  const raw = JSON.stringify(payload, null, 2);
  return raw === "{}" ? "(empty message)" : raw;
}

function roleClass(role: string) {
  if (role === "assistant") return "assistant";
  if (role === "tool") return "tool";
  if (role === "system") return "system";
  return "user";
}

export function ThreadWorkspace({
  session,
  messages,
  running,
  statusLabel,
  workspaceName,
  modelRef,
  models,
  policyLabel,
  goal,
  busy,
  textareaRef,
  labels,
  onGoalChange,
  onModelChange,
  onSubmit,
  onKeyDown,
}: Props) {
  function roleLabel(role: string) {
    if (role === "assistant") return labels.roleAssistant;
    if (role === "tool") return labels.roleTool;
    if (role === "system") return labels.roleSystem;
    return labels.roleUser;
  }

  return (
    <>
      <div className="thread-view">
        <div className="thread-content">
          <section className="task-intro">
            <div className="task-icon" aria-hidden>LC</div>
            <div>
              <span>{labels.newTask}</span>
              <h1>{session.goal}</h1>
              <div className="task-meta">
                <span className={`status-pill ${running ? "running" : session.status}`}>{statusLabel}</span>
                {session.provider && <span>{session.provider}</span>}
                {session.model && <span>{session.model}</span>}
              </div>
            </div>
          </section>

          <section className="message-list">
            {messages.map((message) => (
              <article key={`${message.seq}-${message.role}`} className={`message-row ${roleClass(message.role)}`}>
                <div className="message-avatar">
                  {message.role === "assistant" ? "LC" : message.role === "tool" ? "T" : message.role === "system" ? "S" : "U"}
                </div>
                <div className="message-body">
                  <div className="message-head">
                    <strong>{roleLabel(message.role)}</strong>
                    <span>#{message.seq}</span>
                  </div>
                  <pre>{messageText(message)}</pre>
                </div>
              </article>
            ))}

            {!messages.length && (
              <div className="inline-empty">
                {running && <span className="thinking-pulse"><i /><i /><i /></span>}
                <p>{running ? labels.running : labels.noMessages}</p>
              </div>
            )}
          </section>

          {session.final && (
            <section className="final-result">
              <div className="final-label">
                <CircleCheck size={14} strokeWidth={1.7} aria-hidden />
                {labels.finalAnswer}
              </div>
              <p>{session.final}</p>
            </section>
          )}
        </div>
      </div>

      <div className="composer-dock">
        <form className="composer" onSubmit={onSubmit}>
          <textarea
            ref={textareaRef}
            value={goal}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onGoalChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`${labels.startAnother}…`}
            aria-label={labels.startAnother}
            rows={1}
          />
          <div className="composer-footer">
            <div className="composer-context">
              <span><Folder size={13} strokeWidth={1.7} aria-hidden /> {workspaceName}</span>
              <DesktopSelect
                ariaLabel="Model"
                value={modelRef}
                placeholder={labels.noModels}
                options={models}
                onChange={onModelChange}
                className="composer-model-trigger"
              />
              <span>{policyLabel}</span>
            </div>
            <div className="composer-actions">
              <span className="composer-hint">{labels.composerHint}</span>
              <button className="send-button" disabled={busy || !goal.trim()} aria-label={labels.start}>
                <ArrowUp size={15} strokeWidth={1.9} aria-hidden />
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
