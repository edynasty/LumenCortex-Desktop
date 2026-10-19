import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigState, ModelInfo } from "../../types";
import { copy } from "../../lib/i18n/app-copy";
import { useComposerModelControls } from "./useComposerModelControls";

function model(ref: string, efforts?: string[]): ModelInfo {
  return {
    ref,
    providerName: ref.split("/")[0].toUpperCase(),
    modelName: ref.split("/")[1],
    modelID: ref.split("/")[1],
    context: 65536,
    output: 8192,
    toolCalling: true,
    inputModalities: ["text"],
    reasoningFormat: efforts ? "reasoning-effort" : "",
    efforts,
    apiKeySet: true,
  };
}

const models = [model("test/a", ["low", "high"]), model("test/b", ["low", "medium", "high"]), model("test/plain")];

function setup(initialRef = "test/a") {
  const selectModel = vi.fn();
  const config: Pick<ConfigState, "models" | "model"> = { models, model: "test/a" };
  const rendered = renderHook(
    (props: { modelRef: string }) =>
      useComposerModelControls({
        config,
        session: undefined,
        labels: copy.en,
        selectModel,
        modelRef: props.modelRef,
      }),
    { initialProps: { modelRef: initialRef } },
  );
  return { ...rendered, selectModel };
}

describe("useComposerModelControls effort", () => {
  beforeEach(() => localStorage.clear());

  it("keeps auto when switching to another model with levels", () => {
    const { result, rerender, selectModel } = setup();
    act(() => result.current.setEffort("auto"));
    expect(result.current.effectiveEffort).toBe("auto");

    act(() => result.current.selectModelFromPicker("test/b"));
    expect(selectModel).toHaveBeenCalledWith("test/b");
    rerender({ modelRef: "test/b" });
    expect(result.current.effortOptions).toEqual(["low", "medium", "high"]);
    expect(result.current.effectiveEffort).toBe("auto");
  });

  it("drops auto when switching to a model without reasoning levels", () => {
    const { result, rerender } = setup();
    act(() => result.current.setEffort("auto"));
    act(() => result.current.selectModelFromPicker("test/plain"));
    rerender({ modelRef: "test/plain" });
    expect(result.current.effortOptions).toEqual([]);
    expect(result.current.effectiveEffort).toBeUndefined();
  });

  it("still resets a concrete level the next model does not list", () => {
    const { result, rerender } = setup("test/b");
    act(() => result.current.setEffort("medium"));
    act(() => result.current.selectModelFromPicker("test/a"));
    rerender({ modelRef: "test/a" });
    expect(result.current.effectiveEffort).toBeUndefined();
  });

  it("remembers auto across a remount", () => {
    const first = setup();
    act(() => first.result.current.setEffort("auto"));
    first.unmount();

    const second = setup();
    expect(second.result.current.effectiveEffort).toBe("auto");
  });
});
