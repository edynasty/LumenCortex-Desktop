import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { initialSidebarCollapsed, useSidebarCollapsedPreference } from "./sidebar-preference";

describe("desktop sidebar preference", () => {
  beforeEach(() => localStorage.clear());

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
});
