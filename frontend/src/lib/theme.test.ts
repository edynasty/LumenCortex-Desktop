import { beforeEach, describe, expect, it, vi } from "vitest";

const setWindowBackground = vi.fn();
vi.mock("./bridge", () => ({ setWindowBackground: (...rgb: number[]) => setWindowBackground(...rgb) }));

import { applyThemePreference, initialThemePreference, parseHexColour, resolveTheme } from "./theme";

describe("theme preference", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to system and accepts stored overrides", () => {
    expect(initialThemePreference()).toBe("system");
    localStorage.setItem("lcx-theme", "dark");
    expect(initialThemePreference()).toBe("dark");
    localStorage.setItem("lcx-theme", "invalid");
    expect(initialThemePreference()).toBe("system");
  });

  it("resolves system preference without changing explicit overrides", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("parses #rrggbb ground colours and refuses anything else", () => {
    expect(parseHexColour("#0b111c")).toEqual([11, 17, 28]);
    expect(parseHexColour(" #EEF2F8 ")).toEqual([238, 242, 248]);
    expect(parseHexColour("")).toBeNull();
    expect(parseHexColour("rgba(0, 0, 0, 0.5)")).toBeNull();
    expect(parseHexColour("#fff")).toBeNull();
  });

  it("paints the native window with the resolved theme's --bg-window", () => {
    setWindowBackground.mockClear();
    const style = document.createElement("style");
    style.textContent = ':root[data-theme="dark"] { --bg-window: #0b111c } :root[data-theme="light"] { --bg-window: #eef2f8 }';
    document.head.append(style);
    try {
      applyThemePreference("dark");
      expect(setWindowBackground).toHaveBeenLastCalledWith(11, 17, 28);
      applyThemePreference("light");
      expect(setWindowBackground).toHaveBeenLastCalledWith(238, 242, 248);
    } finally {
      style.remove();
    }
  });
});
