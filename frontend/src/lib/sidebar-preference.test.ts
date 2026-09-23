import { act, fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { initialSidebarCollapsed, useSidebarCollapsedPreference } from "./sidebar-preference";

describe("desktop sidebar preference", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: true,
        media: "(min-width: 821px)",
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  });

  it("defaults expanded and restores a saved collapsed preference", () => {
    expect(initialSidebarCollapsed()).toBe(false);
    localStorage.setItem("lcx-sidebar-collapsed", "1");
    expect(initialSidebarCollapsed()).toBe(true);
  });

  it("persists collapse changes", () => {
    const { result } = renderHook(() => useSidebarCollapsedPreference());
    act(() => result.current[1](true));
    expect(localStorage.getItem("lcx-sidebar-collapsed")).toBe("1");
    act(() => result.current[1](false));
    expect(localStorage.getItem("lcx-sidebar-collapsed")).toBe("0");
  });

  it("toggles with Command or Control B on desktop", () => {
    const { result } = renderHook(() => useSidebarCollapsedPreference());

    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(result.current[0]).toBe(true);

    fireEvent.keyDown(window, { key: "B", ctrlKey: true });
    expect(result.current[0]).toBe(false);
  });

  it("ignores the desktop shortcut at mobile widths", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: false,
        media: "(min-width: 821px)",
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    const { result } = renderHook(() => useSidebarCollapsedPreference());

    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(result.current[0]).toBe(false);
  });
});
