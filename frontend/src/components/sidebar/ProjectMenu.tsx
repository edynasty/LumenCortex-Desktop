/*
 * Project switcher menu for the sidebar trigger.
 *
 * The old AnchoredPopover variant was absolutely positioned inside the sidebar frame, so the
 * `overflow: hidden` sidebar slot clipped it, its width was bound to the trigger, and paths
 * truncated silently. This menu is portaled to `document.body`, positioned against the
 * trigger's live rect, flips above and shifts to stay inside the window at every width, and
 * sizes itself to its content (min 280 px, capped near half the window) instead of the trigger.
 *
 * Keyboard: open with Enter/Space/ArrowDown/ArrowUp on the trigger; inside, ArrowUp/Down/Home/
 * End walk the project rows, ArrowRight reaches a row's copy-path action and then its remove
 * action, Delete/Backspace removes the focused recent entry, Enter opens, Escape closes and
 * restores focus to the trigger, Tab closes and moves on. Focus is a roving tabindex over
 * `role="menuitemradio"` selects plus the copy and remove `role="menuitem"` actions.
 *
 * Like IntelliJ's recent projects, an entry whose folder is gone stays listed but greyed and
 * inert, and every entry except the open project can be removed from the list (the folder is
 * never touched).
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { copyText } from "../../lib/clipboard";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";
import { PathLabel } from "../primitives/PathLabel";

/** Keep the menu this far inside the window edges / this far from the trigger. */
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;
/** How long the per-row copy confirmation stays visible. */
const COPY_CONFIRM_MS = 1600;

type Props = {
  open: boolean;
  /** The trigger button; the menu anchors to it and receives restored focus. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  workspace: string;
  recentProjects: string[];
  /** Entries whose directory no longer exists. */
  missingProjects?: string[];
  /** Drops an entry from Desktop's recent list; absent means entries cannot be removed. */
  onRemoveProject?: (path: string) => void;
  labels: AppCopy;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
};

type CopyState = { path: string; ok: boolean } | null;

/** Final path segment of a workspace path, tolerating Windows separators and trailing slashes. */
export function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

export function ProjectMenu({ open, triggerRef, onClose, workspace, recentProjects, missingProjects = [], onRemoveProject, labels, onPickWorkspace, onOpenWorkspace }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const copyRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const removeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const copyTimer = useRef<number | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const [rovingIndex, setRovingIndex] = useState(0);
  const [copied, setCopied] = useState<CopyState>(null);

  const projects = recentProjects.slice(0, 8);
  const missing = new Set(missingProjects);
  const rowCount = projects.length + 1; // project selects + the "open project" item
  const removable = (path: string) => Boolean(onRemoveProject) && path !== workspace;

  const closeWithFocusOnTrigger = () => {
    triggerRef.current?.focus();
    onClose();
  };

  const openProject = (path: string) => {
    if (missing.has(path)) return;
    if (path !== workspace) onOpenWorkspace(path);
    closeWithFocusOnTrigger();
  };

  // Focus stays at the same position: the next entry moves up into it (or "Open project…").
  const removeProject = (path: string, index: number) => {
    if (!removable(path)) return;
    pendingFocus.current = Math.min(index, projects.length - 1);
    onRemoveProject?.(path);
  };

  const copyProjectPath = async (path: string) => {
    const ok = await copyText(path);
    setCopied({ path, ok });
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(null), COPY_CONFIRM_MS);
  };

  // Anchor to the trigger: place below, flip above when that does not fit, and clamp
  // horizontally and vertically so no part ever leaves the window. Placement writes the
  // styles directly — a state round-trip would re-render between the two effects, and any
  // "hidden until placed" flag keeps the row unfocusable in this same commit (Chromium
  // focusability uses the last style recalc), silently no-op'ing the row focus below.
  // Layout effects run before the first paint, so the unplaced frame is never painted.
  // Re-measured on scroll and resize while open, so sidebar scrolling keeps the menu on
  // its trigger.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const rect = trigger.getBoundingClientRect();
      const box = menu.getBoundingClientRect();
      const maxWidth = window.innerWidth - 2 * VIEWPORT_MARGIN;
      const maxHeight = window.innerHeight - 2 * VIEWPORT_MARGIN;
      const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), maxWidth - box.width + VIEWPORT_MARGIN);
      const below = rect.bottom + ANCHOR_GAP;
      const fitsBelow = box.height <= window.innerHeight - below - VIEWPORT_MARGIN;
      const top = fitsBelow || rect.top - ANCHOR_GAP - box.height < VIEWPORT_MARGIN
        ? below
        : Math.max(rect.top - ANCHOR_GAP - box.height, VIEWPORT_MARGIN);
      menu.style.left = `${left}px`;
      menu.style.top = `${Math.min(top, maxHeight - box.height + VIEWPORT_MARGIN)}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, triggerRef]);

  // On open, focus the current project's row (first row otherwise), like a native menu.
  useLayoutEffect(() => {
    if (!open) return;
    const current = projects.indexOf(workspace);
    const index = current >= 0 ? current : 0;
    setRovingIndex(index);
    rowRefs.current[index]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on an outside press; the trigger toggles itself and is excluded here.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onClose, triggerRef]);

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    pendingFocus.current = null;
    setRovingIndex(index);
    rowRefs.current[index]?.focus();
  }, [projects.length]);

  const focusRow = (index: number) => {
    const next = ((index % rowCount) + rowCount) % rowCount;
    setRovingIndex(next);
    rowRefs.current[next]?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") {
      // Consume the keydown itself: when the sidebar is a drawer, restoring focus to the
      // trigger would otherwise hand the same Escape to the drawer's focus trap and close
      // both layers at once. One key closes one layer, like a native menu.
      event.preventDefault();
      event.stopPropagation();
      closeWithFocusOnTrigger();
      return;
    }
    if (event.key === "Tab") {
      // Focus the trigger first so the default Tab action then moves focus onward from it,
      // the way native menus hand focus past their trigger.
      triggerRef.current?.focus();
      onClose();
      return;
    }
    const active = document.activeElement;
    const row = rowRefs.current.indexOf(active as HTMLButtonElement);
    const copyRow = copyRefs.current.indexOf(active as HTMLButtonElement);
    const removeRow = removeRefs.current.indexOf(active as HTMLButtonElement);
    const index = row >= 0 ? row : copyRow >= 0 ? copyRow : removeRow;
    if (index < 0) return;
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); focusRow(index + 1); return;
      case "ArrowUp": event.preventDefault(); focusRow(index - 1); return;
      case "Home": event.preventDefault(); focusRow(0); return;
      case "End": event.preventDefault(); focusRow(rowCount - 1); return;
    }
    if (row >= 0) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        copyRefs.current[row]?.focus();
      } else if ((event.key === "Delete" || event.key === "Backspace") && row < projects.length) {
        event.preventDefault();
        removeProject(projects[row], row);
      }
    } else if (copyRow >= 0) {
      if (event.key === "ArrowLeft") { event.preventDefault(); focusRow(copyRow); }
      if (event.key === "ArrowRight") { event.preventDefault(); removeRefs.current[copyRow]?.focus(); }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      copyRefs.current[removeRow]?.focus();
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={labels.projectMenu}
      className="project-menu-popover"
      onKeyDown={onKeyDown}
    >
      <div className="sr-only" role="status" aria-live="polite">
        {copied ? (copied.ok ? labels.copiedPath : labels.copyFailed) : ""}
      </div>
      {projects.length > 0 && <div className="menu-label">{labels.recentProjects}</div>}
      {projects.map((path, index) => {
        const activeProject = path === workspace;
        const gone = missing.has(path);
        const copiedHere = copied?.path === path && copied.ok;
        return (
          <div key={path} className={`project-menu-row${gone ? " is-missing" : ""}`} role="presentation">
            <button
              ref={(el) => { rowRefs.current[index] = el; }}
              type="button"
              role="menuitemradio"
              aria-checked={activeProject}
              aria-disabled={gone || undefined}
              aria-description={gone ? labels.projectMissing : undefined}
              tabIndex={rovingIndex === index ? 0 : -1}
              className="menu-item project-menu-item"
              title={gone ? `${labels.projectMissing}: ${path}` : path}
              onClick={() => openProject(path)}
            >
              <Icon name="project" size={15} />
              <span className="menu-item-body">
                <span className="project-menu-name">{basename(path)}</span>
                <span className="menu-item-sub project-menu-path">
                  {gone && <span className="project-menu-missing">{labels.projectMissing} · </span>}
                  <PathLabel path={path} />
                </span>
              </span>
              {activeProject && <Icon name="checkmark" size={14} className="menu-check" />}
            </button>
            <button
              ref={(el) => { copyRefs.current[index] = el; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`project-menu-action${copiedHere ? " is-copied" : ""}`}
              title={labels.copyPath}
              aria-label={copiedHere ? labels.copiedPath : labels.copyPath}
              onClick={() => void copyProjectPath(path)}
            >
              <Icon name={copiedHere ? "checkmark" : "copy"} size={14} />
            </button>
            {removable(path) && (
              <button
                ref={(el) => { removeRefs.current[index] = el; }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="project-menu-action project-menu-remove"
                title={labels.removeRecentProject}
                aria-label={`${labels.removeRecentProject}: ${basename(path)}`}
                onClick={() => removeProject(path, index)}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        );
      })}
      {projects.length > 0 && <div className="menu-sep" />}
      <button
        ref={(el) => { rowRefs.current[projects.length] = el; }}
        type="button"
        role="menuitem"
        tabIndex={rovingIndex === projects.length ? 0 : -1}
        className="menu-item project-menu-item"
        onClick={() => { onClose(); onPickWorkspace(); }}
      >
        <Icon name="projectOpen" size={15} />
        <span className="menu-item-body"><span className="project-menu-name">{labels.openProjectEllipsis}</span></span>
      </button>
    </div>,
    document.body
  );
}
