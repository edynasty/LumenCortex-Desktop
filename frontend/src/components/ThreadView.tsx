import { FormEvent, KeyboardEvent } from "react";
import { Icon } from "./Icon";
import type { Copy } from "../i18n";
import type { Message, Session } from "../types";
import { messageText, roleText } from "../ui-utils";

type ComposerProps = {
  copy: Copy;
  goal: string;
  busy: boolean;
  onGoal: (value: string) => void;
  onSubmit: (event?: FormEvent) => Promise<void>;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

function TaskComposer({ copy, goal, busy, onGoal, onSubmit, onKeyDown }: ComposerProps) {
  return (
    <form className="task-composer" onSubmit={(event) => void onSubmit(event)}>
      <textarea
        id="task-composer"
        value={goal}
        onChange={(event) => onGoal(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={copy.taskPlaceholder}
        rows={5}
        autoFocus
      />
      <div className="composer-toolbar">
        <div className="composer-context">
          <span><Icon name="folder" size={13} /> {copy.workspace}</span>
          <span><Icon name="terminal" size={13} /> Agent</span>
        </div>
        <div className="composer-submit">
          <span>{copy.shortcut}</span>
          <button type="submit" disabled={busy || !goal.trim()} aria-label={copy.createTask}>
            <Icon name="play" size={15} />
          </button>
        </div>
      </div>
    </form>
  );
}

type Props = {
  copy: Copy;
  locale: "zh" | "en";
  workspace: string;
  current?: Session;
  messages: Message[];
  goal: string;
  model: string;
  busy: boolean;
  onGoal: (value: string) => void;
  onCreate: (event?: FormEvent) => Promise<void>;
  onComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPickWorkspace: () => void;
  onNewTask: () => void;
  onOpenSettings: () => void;
};

export function ThreadView({
  copy,
  locale,
  workspace,
  current,
  messages,
  goal,
  model,
  busy,
  onGoal,
  onCreate,
  onComposerKeyDown,
  onPickWorkspace,
  onNewTask,
  onOpenSettings,
}: Props) {
  if (!workspace) {
    return (
      <section className="thread-canvas">
        <div className="empty-state">
          <div className="empty-mark"><Icon name="spark" size={26} /></div>
          <h1>{copy.emptyTitle}</h1>
          <p>{copy.emptyText}</p>
          <button className="primary-action" onClick={onPickWorkspace}>
            <Icon name="folder" size={16} />
            {copy.openWorkspace}
          </button>
        </div>
      </section>
    );
  }

  if (!current) {
    return (
      <section className="thread-canvas">
        <div className="new-task-state">
          <div className="new-task-heading">
            <span className="new-task-mark"><Icon name="spark" size={18} /></span>
            <h1>{copy.emptyTitle}</h1>
          </div>
          <TaskComposer
            copy={copy}
            goal={goal}
            busy={busy}
            onGoal={onGoal}
            onSubmit={onCreate}
            onKeyDown={onComposerKeyDown}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="thread-canvas">
      <div className="conversation">
        <div className="conversation-inner">
          <div className="task-hero">
            <div className="task-avatar">{copy.user.slice(0, 1)}</div>
            <div>
              <span>{copy.user}</span>
              <h1>{current.goal}</h1>
            </div>
          </div>

          {messages.map((message) => (
            <article key={message.seq} className={"message-row role-" + message.role}>
              <div className="message-avatar">
                {message.role === "assistant" ? (
                  <Icon name="spark" size={14} />
                ) : message.role === "tool" ? (
                  <Icon name="terminal" size={14} />
                ) : (
                  roleText(copy, message.role).slice(0, 1)
                )}
              </div>
              <div className="message-body">
                <div className="message-heading">
                  <strong>{roleText(copy, message.role)}</strong>
                  <span>#{message.seq}</span>
                </div>
                <pre>{messageText(message, locale)}</pre>
              </div>
            </article>
          ))}

          {!messages.length && (
            <div className="conversation-placeholder">
              <Icon name="spark" size={18} />
              <p>{copy.noMessages}</p>
              <small>{copy.taskReady}</small>
            </div>
          )}

          {current.final && (
            <article className="final-card">
              <div className="final-heading">
                <Icon name="spark" size={15} />
                <strong>{copy.finalResponse}</strong>
              </div>
              <pre>{current.final}</pre>
            </article>
          )}
        </div>
      </div>

      <div className="followup-bar">
        <button className="followup-new" onClick={onNewTask}>
          <Icon name="plus" size={15} />
          {copy.newTask}
        </button>
        <div className="followup-meta">
          <span>{current.provider || "openai-compatible"}</span>
          <span>·</span>
          <span>{current.model || model || "LCX_MODEL"}</span>
          <button onClick={onOpenSettings}>{copy.settings}</button>
        </div>
      </div>
    </section>
  );
}
