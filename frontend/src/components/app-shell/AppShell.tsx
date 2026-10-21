/*
 * Application window. One unified toolbar spans the window (the native traffic lights sit in its
 * lead, see main.go TitleBarHiddenInset); below it the global rail, the contextual sidebar, the
 * main pane and the inspector sit side by side.
 *
 *   ┌ toolbar: (traffic lights) [sidebar]  │ title · runtime            [actions] [inspector] ┐
 *   │ rail │ sidebar (resizable)           │ main pane (glass sheet)    │ inspector (sheet)    │
 *
 * Collapse is an animated width change of registered custom properties (shell.css), so the
 * toolbar lead, the sidebar slot and the panes move together and nothing remounts.
 * Below INSPECTOR_DOCK_MIN the inspector is a drawer, below SIDEBAR_DOCK_MIN the sidebar too,
 * and below COMPACT_MAX the rail moves into the sidebar drawer.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { INSPECTOR_WIDTH, SIDEBAR_WIDTH, type LayoutPreference } from "../../lib/layout-preference";
import { Drawer } from "../primitives/Drawer";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import { ResizeHandle } from "./ResizeHandle";
import "./shell.css";

export const INSPECTOR_DOCK_MIN = 1240;
export const SIDEBAR_DOCK_MIN = 880;
export const COMPACT_MAX = 640;
const NARROW_MAX = 1100;
const RAIL_W = 52;
const MAIN_MIN = 460;

export type ShellSize = { compact: boolean; narrow: boolean };

type Props = {
  labels: AppCopy;
  layout: LayoutPreference;
  onLayoutChange: (layout: LayoutPreference) => void;
  rail: ReactNode;
  sidebar: ReactNode;
  /** Present when the page has an inspector; the toolbar toggle and ⌘I only exist then. */
  inspector?: ReactNode;
  inspectorOpen: boolean;
  onInspectorOpenChange: (open: boolean) => void;
  sidebarDrawerOpen: boolean;
  onSidebarDrawerOpenChange: (open: boolean) => void;
  /** Shown in the toolbar lead while the sidebar (and its New thread row) is hidden. */
  onNewThread?: () => void;
  toolbar: (size: ShellSize) => ReactNode;
  children: ReactNode;
  /** Settings sheet, palette and dialogs: inside the window so the window container sizes them. */
  overlays?: ReactNode;
  /** Run started, waiting at a gate, or ended: spoken through the one polite live region. */
  announcement?: string;
};

function useWindowWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function AppShell({
  labels,
  layout,
  onLayoutChange,
  rail,
  sidebar,
  inspector,
  inspectorOpen: inspectorRequested,
  onInspectorOpenChange,
  sidebarDrawerOpen,
  onSidebarDrawerOpenChange,
  onNewThread,
  toolbar,
  children,
  overlays,
  announcement,
}: Props) {
  const [ref, width] = useWindowWidth();
  const [resizing, setResizing] = useState(false);

  const compact = width < COMPACT_MAX;
  const size: ShellSize = { compact, narrow: width < NARROW_MAX };
  const sidebarDocks = width >= SIDEBAR_DOCK_MIN;
  const inspectorDocks = width >= INSPECTOR_DOCK_MIN;
  const inspectorOpen = inspectorRequested && Boolean(inspector);
  const sidebarOpen = sidebarDocks ? !layout.sidebarCollapsed : sidebarDrawerOpen;
  const sidebarInline = sidebarDocks && sidebarOpen;
  const inspectorInline = inspectorDocks && inspectorOpen;

  // The sidebar gives way before the main pane does.
  const inspectorReserved = inspectorInline ? layout.inspectorWidth : 0;
  const sidebarMax = Math.max(SIDEBAR_WIDTH.min, Math.min(SIDEBAR_WIDTH.max, width - RAIL_W - inspectorReserved - MAIN_MIN));
  const sidebarW = Math.min(layout.sidebarWidth, sidebarMax);
  const inspectorMax = Math.max(INSPECTOR_WIDTH.min, Math.min(INSPECTOR_WIDTH.max, width - RAIL_W - (sidebarInline ? sidebarW : 0) - MAIN_MIN));
  const inspectorW = Math.min(layout.inspectorWidth, inspectorMax);
  // Leaving the docked range closes the inspector rather than covering the content with a drawer,
  // and docking again dismisses a sidebar drawer. Only the transitions matter, so the callbacks
  // (new identities every render) are deliberately not dependencies.
  useEffect(() => {
    if (!inspectorDocks) onInspectorOpenChange(false);
  }, [inspectorDocks]);
  useEffect(() => {
    if (sidebarDocks) onSidebarDrawerOpenChange(false);
  }, [sidebarDocks]);

  const toggleSidebar = () => {
    if (sidebarDocks) onLayoutChange({ ...layout, sidebarCollapsed: !layout.sidebarCollapsed });
    else onSidebarDrawerOpenChange(!sidebarDrawerOpen);
  };

  const stateRef = useRef({ toggleSidebar, inspectorAvailable: Boolean(inspector), inspectorOpen, onInspectorOpenChange });
  stateRef.current = { toggleSidebar, inspectorAvailable: Boolean(inspector), inspectorOpen, onInspectorOpenChange };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      const current = stateRef.current;
      if (key === "b") {
        event.preventDefault();
        current.toggleSidebar();
      } else if (key === "i" && current.inspectorAvailable) {
        event.preventDefault();
        current.onInspectorOpenChange(!current.inspectorOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const style = {
    "--sidebar-current": `${sidebarInline ? sidebarW : 0}px`,
    "--sidebar-w": `${sidebarW}px`,
    "--inspector-current": `${inspectorInline ? inspectorW : 0}px`,
    "--inspector-w": `${inspectorW}px`,
  } as CSSProperties;

  const classes = [
    "lc-window",
    sidebarInline ? "has-sidebar" : "no-sidebar",
    inspectorInline ? "has-inspector" : "",
    compact ? "is-compact" : "",
    resizing ? "is-resizing" : "",
  ].filter(Boolean).join(" ");

  return (
    <div ref={ref} className={classes} style={style}>
      <header className="toolbar drag-region">
        <div className="toolbar-lead">
          <IconButton
            icon={<Icon name="sidebar" />}
            label={`${labels.toggleSidebar} ⌘B`}
            active={sidebarOpen && !sidebarInline}
            aria-keyshortcuts="Meta+B Control+B"
            onClick={toggleSidebar}
          />
          {!sidebarInline && onNewThread && (
            <IconButton icon={<Icon name="newThread" />} label={`${labels.newTask} ⌘N`} onClick={onNewThread} />
          )}
        </div>
        {toolbar(size)}
      </header>

      <div className="window-body">
        {!compact && rail}
        {sidebarDocks && (
          <div className="sidebar-slot" aria-hidden={!sidebarInline}>
            <div className="sidebar-frame">{sidebar}</div>
            {sidebarInline && (
              <ResizeHandle
                side="end"
                width={sidebarW}
                min={SIDEBAR_WIDTH.min}
                max={sidebarMax}
                initial={SIDEBAR_WIDTH.initial}
                label={labels.resizeSidebar}
                onResize={(sidebarWidth) => onLayoutChange({ ...layout, sidebarWidth })}
                onCollapse={() => onLayoutChange({ ...layout, sidebarCollapsed: true })}
                onDragChange={setResizing}
              />
            )}
          </div>
        )}

        <main className="sheet main-pane">{children}</main>

        <div className="inspector-slot" aria-hidden={!inspectorInline}>
          {inspectorInline && (
            <>
              <ResizeHandle
                side="start"
                width={inspectorW}
                min={INSPECTOR_WIDTH.min}
                max={inspectorMax}
                initial={INSPECTOR_WIDTH.initial}
                label={labels.resizeInspector}
                onResize={(inspectorWidth) => onLayoutChange({ ...layout, inspectorWidth })}
                onCollapse={() => onInspectorOpenChange(false)}
                onDragChange={setResizing}
              />
              <div className="inspector-frame">{inspector}</div>
            </>
          )}
        </div>

        <Drawer
          open={!sidebarDocks && sidebarOpen}
          side="left"
          label={labels.sidebar}
          closeLabel={labels.close}
          onOpenChange={onSidebarDrawerOpenChange}
        >
          {compact && rail}
          {sidebar}
        </Drawer>
        <Drawer
          open={!inspectorDocks && inspectorOpen}
          side="right"
          label={labels.inspector}
          closeLabel={labels.close}
          onOpenChange={onInspectorOpenChange}
        >
          {inspector}
        </Drawer>
      </div>
      {overlays}
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    </div>
  );
}
