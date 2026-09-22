import { describe, expect, it } from "vitest";
import { copy } from "./app-copy";

describe("app copy", () => {
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
