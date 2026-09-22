import { beforeEach, describe, expect, it } from "vitest";
import { initialThemePreference, resolveTheme } from "./theme";

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
});
