/* ⌘K: jump to a thread or run an app command. Every entry maps to an existing action. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";
import { Modal } from "../primitives/Modal";
import type { SidebarGroup } from "../sidebar/Sidebar";

const PALETTE_THREADS = 8;

export type PaletteAction = { id: string; icon: ReactNode; label: string; keys?: string; run: () => void };

type Props = {
  labels: AppCopy;
  groups: SidebarGroup[];
  actions: PaletteAction[];
  onOpenThread: (sessionId: string) => void;
  onClose: () => void;
};

export function CommandPalette({ labels, groups, actions, onOpenThread, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const threads: PaletteAction[] = groups
      .filter((group) => group.key !== "archived")
      .flatMap((group) => group.sessions)
      .filter((thread) => !q || thread.title.toLowerCase().includes(q) || thread.session.goal.toLowerCase().includes(q))
      .slice(0, PALETTE_THREADS)
      .map((thread) => ({
        id: thread.session.id,
        icon: <Icon name={thread.runtime.kind === "worktree" ? "worktree" : "discussion"} size={15} />,
        label: thread.title,
        run: () => onOpenThread(thread.session.id),
      }));
    return [
      { label: labels.paletteActions, entries: actions.filter((action) => !q || action.label.toLowerCase().includes(q)) },
      { label: labels.paletteThreads, entries: threads },
    ].filter((section) => section.entries.length > 0);
  }, [actions, groups, labels, onOpenThread, query]);

  const flat = sections.flatMap((section) => section.entries);
  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    list.current?.querySelector(".is-cursor")?.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);

  const run = (entry: PaletteAction) => {
    onClose();
    entry.run();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(flat.length - 1, value + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
    } else if (event.key === "Enter" && flat[cursor]) {
      event.preventDefault();
      run(flat[cursor]);
    }
  };

  return (
    <Modal label={labels.commandPalette} onClose={onClose} className="palette">
      <div className="palette-input">
        <Icon name="search" size={16} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={labels.paletteSearch}
          aria-label={labels.paletteSearch}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-activedescendant={flat[cursor] ? `palette-${flat[cursor].id}` : undefined}
        />
        <kbd className="kbd">Esc</kbd>
      </div>
      <div className="palette-list" ref={list} role="listbox" id="command-palette-list" aria-label={labels.commandPalette}>
        {flat.length === 0 && <p className="popover-empty">{labels.paletteNoResults}</p>}
        {sections.map((section) => (
          <div key={section.label} role="group" aria-label={section.label}>
            <div className="menu-label">{section.label}</div>
            {section.entries.map((entry) => {
              const index = flat.indexOf(entry);
              return (
                <button
                  key={entry.id}
                  id={`palette-${entry.id}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={cursor === index}
                  className={`palette-row ${cursor === index ? "is-cursor" : ""}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => run(entry)}
                >
                  <span className="palette-glyph">{entry.icon}</span>
                  <span className="palette-label">{entry.label}</span>
                  {entry.keys && <kbd className="kbd">{entry.keys}</kbd>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}
