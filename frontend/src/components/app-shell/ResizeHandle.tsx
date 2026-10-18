/*
 * Pane resize handle (an ARIA window splitter). Drag, arrow keys (Shift = larger steps),
 * Home/End, double-click to reset. Dragging well past the minimum collapses the pane, the
 * way macOS split views do.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const COLLAPSE_SLOP = 72;

export function ResizeHandle({ side, width, min, max, initial, label, onResize, onCollapse, onDragChange }: {
  /** Which edge of the pane the handle sits on: `end` for a left pane, `start` for a right pane. */
  side: "start" | "end";
  width: number;
  min: number;
  max: number;
  initial: number;
  label: string;
  onResize: (width: number) => void;
  onCollapse?: () => void;
  onDragChange?: (dragging: boolean) => void;
}) {
  const start = useRef<{ x: number; width: number; scale: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));
  const direction = side === "end" ? 1 : -1;

  const setDrag = (value: boolean) => {
    setDragging(value);
    onDragChange?.(value);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const el = event.currentTarget;
    // The Demo may scale the window to fit; convert screen pixels back to layout pixels.
    const scale = el.getBoundingClientRect().height / Math.max(1, el.offsetHeight) || 1;
    start.current = { x: event.clientX, width, scale };
    el.setPointerCapture(event.pointerId);
    setDrag(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const next = s.width + ((event.clientX - s.x) / s.scale) * direction;
    if (onCollapse && next < min - COLLAPSE_SLOP) {
      start.current = null;
      setDrag(false);
      onCollapse();
      return;
    }
    onResize(clamp(next));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    start.current = null;
    setDrag(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 12;
    const grow = side === "end" ? "ArrowRight" : "ArrowLeft";
    const shrink = side === "end" ? "ArrowLeft" : "ArrowRight";
    const next = event.key === grow ? width + step : event.key === shrink ? width - step
      : event.key === "Home" ? min : event.key === "End" ? max : event.key === "Enter" ? initial : null;
    if (next === null) return;
    event.preventDefault();
    onResize(clamp(next));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className={`resize-handle is-${side} ${dragging ? "is-dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onResize(initial)}
      onKeyDown={onKeyDown}
    />
  );
}
