import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { INSPECTOR_WIDTH, SIDEBAR_WIDTH, initialLayoutPreference, useLayoutPreference } from "./layout-preference";

describe("layout preference", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to an expanded sidebar at the initial widths", () => {
    expect(initialLayoutPreference()).toEqual({
      sidebarCollapsed: false,
      sidebarWidth: SIDEBAR_WIDTH.initial,
      inspectorWidth: INSPECTOR_WIDTH.initial,
    });
  });

  it("keeps a collapse choice saved under the pre-Lumen-Glass key", () => {
    localStorage.setItem("lcx-sidebar-collapsed", "1");
    expect(initialLayoutPreference().sidebarCollapsed).toBe(true);
  });

  it("clamps stored widths and ignores corrupt values", () => {
    localStorage.setItem("lcx-layout", JSON.stringify({ sidebarWidth: 9999, inspectorWidth: "wide" }));
    expect(initialLayoutPreference()).toMatchObject({ sidebarWidth: SIDEBAR_WIDTH.max, inspectorWidth: INSPECTOR_WIDTH.initial });
    localStorage.setItem("lcx-layout", "{not json");
    expect(initialLayoutPreference().sidebarWidth).toBe(SIDEBAR_WIDTH.initial);
  });

  it("persists changes and restores them on the next launch", () => {
    const { result } = renderHook(() => useLayoutPreference());
    act(() => result.current[1]({ sidebarCollapsed: true, sidebarWidth: 300, inspectorWidth: 360 }));
    expect(initialLayoutPreference()).toEqual({ sidebarCollapsed: true, sidebarWidth: 300, inspectorWidth: 360 });
    expect(localStorage.getItem("lcx-sidebar-collapsed")).toBeNull();
  });
});
