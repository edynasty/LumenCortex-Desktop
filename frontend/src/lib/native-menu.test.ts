import { afterEach, describe, expect, it, vi } from "vitest";

const setMenuLocale = vi.fn();
vi.mock("./bridge", () => ({ bridge: { setMenuLocale: (locale: string) => setMenuLocale(locale) } }));

import { installNativeMenu, menuOwnsKey, nativeMenuInstalled } from "./native-menu";

describe("native menu stand-down", () => {
  afterEach(() => setMenuLocale.mockReset());

  it("owns exactly the menu's keys, and only while Go reports a native menu", async () => {
    setMenuLocale.mockResolvedValue(false);
    await installNativeMenu("zh-CN");
    expect(nativeMenuInstalled()).toBe(false);
    for (const key of ["k", ",", "n", "b"]) expect(menuOwnsKey(key)).toBe(false);

    setMenuLocale.mockResolvedValue(true);
    await installNativeMenu("en");
    expect(setMenuLocale).toHaveBeenLastCalledWith("en");
    for (const key of ["k", ",", "n", "b"]) expect(menuOwnsKey(key)).toBe(true);
    // Keys the menu does not own (⌘I, ⌘1-4) stay with the webview.
    for (const key of ["i", "1", "2", "3", "4"]) expect(menuOwnsKey(key)).toBe(false);
  });

  it("a failing bridge call leaves the webview handling its keys", async () => {
    setMenuLocale.mockResolvedValue(true);
    await installNativeMenu("en");
    setMenuLocale.mockRejectedValue(new Error("no bridge"));
    await installNativeMenu("en");
    expect(nativeMenuInstalled()).toBe(false);
    expect(menuOwnsKey("k")).toBe(false);
  });
});
