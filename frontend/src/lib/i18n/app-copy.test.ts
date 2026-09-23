import { beforeEach, describe, expect, it } from "vitest";
import { copy, initialLocale } from "./app-copy";

describe("app copy", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to Chinese unless English was explicitly saved", () => {
    expect(initialLocale()).toBe("zh-CN");
    localStorage.setItem("lcx-locale", "en");
    expect(initialLocale()).toBe("en");
    localStorage.setItem("lcx-locale", "invalid");
    expect(initialLocale()).toBe("zh-CN");
  });

  it("keeps Chinese and English keys aligned and non-empty", () => {
    const zh = copy["zh-CN"];
    const en = copy.en;
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();

    expect(zhKeys).toEqual(enKeys);

    for (const key of zhKeys) {
      expect(String(zh[key as keyof typeof zh]).trim(), `zh-CN.${key}`).not.toBe("");
      expect(String(en[key as keyof typeof en]).trim(), `en.${key}`).not.toBe("");
    }
  });
});
