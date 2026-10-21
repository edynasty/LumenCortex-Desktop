import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePresence } from "./usePresence";

describe("usePresence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays present for the exit and then unmounts", () => {
    const { result, rerender } = renderHook(({ open }) => usePresence(open), { initialProps: { open: true } });
    expect(result.current).toEqual({ present: true, state: "open" });

    rerender({ open: false });
    expect(result.current).toEqual({ present: true, state: "closed" });

    act(() => { vi.advanceTimersByTime(119); });
    expect(result.current.present).toBe(true);
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current).toEqual({ present: false, state: "closed" });
  });

  it("reopening during the exit cancels the unmount", () => {
    const { result, rerender } = renderHook(({ open }) => usePresence(open), { initialProps: { open: true } });
    rerender({ open: false });
    act(() => { vi.advanceTimersByTime(60); });
    rerender({ open: true });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toEqual({ present: true, state: "open" });
  });

  it("takes the exit length from --dur-fast, so reduced motion unmounts at once", () => {
    document.documentElement.style.setProperty("--dur-fast", "1ms");
    try {
      const { result, rerender } = renderHook(({ open }) => usePresence(open), { initialProps: { open: true } });
      rerender({ open: false });
      act(() => { vi.advanceTimersByTime(2); });
      expect(result.current.present).toBe(false);
    } finally {
      document.documentElement.style.removeProperty("--dur-fast");
    }
  });

  it("a layer that never opened is never present", () => {
    const { result } = renderHook(() => usePresence(false));
    expect(result.current.present).toBe(false);
  });
});
