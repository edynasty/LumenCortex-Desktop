import { useEffect, useState } from "react";
import type { Message } from "../../types";
import { Icon } from "../primitives/Icon";
import type { IconName } from "../primitives/icons";
import { PathLabel } from "../primitives/PathLabel";
import { LumenIndicator } from "../brand/A1Mark";

type WorkLabels = {
  workTitle: string;
  workCalls: string;
  showOutput: string;
  hideOutput: string;
};

type ToolMetadata = {
  target: string;
  isPath: boolean;
  detail: string;
  failed: boolean;
};

function parseCall(message: Message): { name: string; content: string } {
  const payload =
    message.json && typeof message.json === "object" && !Array.isArray(message.json)
      ? (message.json as Record<string, unknown>)
      : {};
  const content = typeof payload.content === "string" ? payload.content : JSON.stringify(payload);
  const name = typeof payload.name === "string" ? payload.name : "";
  return { name, content };
}

function metadata(name: string, content: string): ToolMetadata {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const path = typeof parsed.path === "string" ? parsed.path : "";
    const command = typeof parsed.command === "string" ? parsed.command : "";
    const error = typeof parsed.error === "string" ? parsed.error : "";
    const exitCode = typeof parsed.exitCode === "number" ? parsed.exitCode : undefined;
    const truncated =
      parsed.truncated === true ||
      (parsed.stdout && typeof parsed.stdout === "object" && (parsed.stdout as Record<string, unknown>).truncated === true) ||
      (parsed.stderr && typeof parsed.stderr === "object" && (parsed.stderr as Record<string, unknown>).truncated === true);
    const detail = [error, exitCode !== undefined ? `exit ${exitCode}` : "", truncated ? "truncated" : ""].filter(Boolean).join(" · ");
    return {
      target: path || command || error || content,
      isPath: Boolean(path),
      detail,
      failed: Boolean(error) || (exitCode !== undefined && exitCode !== 0) || parsed.ok === false,
    };
  } catch {
    return { target: content, isPath: false, detail: "", failed: false };
  }
}

const kindPatterns: [RegExp, IconName][] = [
  [/search|grep|glob|find/i, "search"],
  [/read|view|cat|file/i, "read"],
  [/edit|write|apply|patch/i, "edit"],
  [/create|new/i, "create"],
  [/shell|exec|bash|command|terminal/i, "shell"],
  [/task|agent|subagent|delegate/i, "subagent"],
  [/mcp/i, "mcp"],
  [/check|test|build/i, "checkRun"],
];

function kindIcon(name: string): IconName {
  for (const [pattern, icon] of kindPatterns) if (pattern.test(name)) return icon;
  return "tool";
}

function ToolRow({ name, content, labels }: { name: string; content: string; labels: WorkLabels }) {
  const [open, setOpen] = useState(false);
  const meta = metadata(name, content);
  const hasOutput = Boolean(content.trim());

  return (
    <li className={`tool-row ${meta.failed ? "is-error" : ""}`}>
      <span className="tool-icon">
        <Icon name={kindIcon(name)} size={14} />
      </span>
      <div className="tool-main">
        <div className="tool-line">
          <span className="tool-verb">{name}</span>
          {meta.isPath
            ? <PathLabel path={meta.target} />
            : <code className="tool-target mono" title={meta.target}>{meta.target}</code>}
          {meta.detail && <span className={`tool-detail ${meta.failed ? "is-bad" : ""}`}>{meta.detail}</span>}
          <span className="tool-spacer" />
          {hasOutput && (
            <button type="button" className="tool-output-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
              {open ? labels.hideOutput : labels.showOutput}
            </button>
          )}
        </div>
        {open && hasOutput && <pre className="tool-output">{content}</pre>}
      </div>
    </li>
  );
}

/**
 * Consecutive tool calls between two messages, folded into one activity line (Lumen Glass).
 * It is narration, not a decision, so it stays light: no card, a hover tint on the head, and
 * an indented timeline of calls when open. A group that is still live stays open and carries
 * the running indicator.
 */
export function WorkGroup({ messages, live, labels }: { messages: Message[]; live?: boolean; labels: WorkLabels }) {
  const [expanded, setExpanded] = useState(Boolean(live));
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setExpanded(Boolean(live));
  }, [live, touched]);

  const calls = messages.map(parseCall).filter((call) => call.name || call.content);
  if (!calls.length) return null;

  const first = calls[0];
  const firstMeta = metadata(first.name, first.content);
  const summary =
    calls.length === 1
      ? `${first.name} ${firstMeta.target.replace(/\\/g, "/").split("/").pop() ?? ""}`.trim()
      : labels.workCalls.replace("{count}", String(calls.length));

  return (
    <div className={`work-group ${live ? "is-live" : ""} ${expanded ? "is-open" : ""}`}>
      <div className="work-head-row">
        <button
          type="button"
          className="work-head"
          onClick={() => {
            setTouched(true);
            setExpanded(!expanded);
          }}
          aria-expanded={expanded}
        >
          <span className="work-head-icon">
            {live ? <LumenIndicator size={14} /> : <Icon name={expanded ? "collapse" : "expand"} size={14} />}
          </span>
          <span className="work-head-title">{labels.workTitle}</span>
          <span className="work-head-summary">{summary}</span>
        </button>
      </div>
      {expanded && (
        <ol className="tool-list">
          {calls.map((call, index) => (
            <ToolRow key={index} name={call.name} content={call.content} labels={labels} />
          ))}
        </ol>
      )}
    </div>
  );
}
