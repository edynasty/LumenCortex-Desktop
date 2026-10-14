import { describe, expect, it } from "vitest";
import {
  baselineModel,
  chooseModel,
  displayedModel,
  executableModels,
  explicitModelRef,
  modelOptions,
  noExplicitModel,
} from "./model-selection";
import { buildAgentConfig } from "./agent-config";
import type { ModelInfo } from "../types";

function model(ref: string, overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    ref,
    providerName: ref.split("/")[0].toUpperCase(),
    modelName: ref.split("/")[1],
    modelID: ref.split("/")[1],
    context: 65536,
    output: 8192,
    toolCalling: true,
    inputModalities: ["text"],
    reasoningFormat: "",
    apiKeySet: true,
    ...overrides,
  };
}

describe("model picker options", () => {
  it("lists only models that can run tools and keeps upstream ids and limits", () => {
    const models = [
      model("demo/coder", { modelName: "Coder", modelID: "upstream-coder", providerName: "Demo", apiKeyEnv: "DEMO_KEY", apiKeySet: false }),
      model("demo/chat-only", { toolCalling: false }),
    ];

    expect(executableModels(models).map((item) => item.ref)).toEqual(["demo/coder"]);
    expect(modelOptions({ model: "demo/coder", models })).toEqual([{
      ref: "demo/coder",
      label: "Coder",
      group: "Demo",
      description: "upstream-coder · 64K ctx · 8K out",
      isDefault: true,
      missingSecret: true,
    }]);
  });

  it("flags a missing key only when the provider references one", () => {
    const options = modelOptions({
      model: "",
      models: [
        model("a/set", { apiKeyEnv: "A_KEY", apiKeySet: true }),
        model("b/anon"),
        model("c/missing", { apiKeyEnv: "C_KEY", apiKeySet: false }),
      ],
    });
    expect(options.map((item) => item.missingSecret)).toEqual([false, false, true]);
  });
});

describe("model selection and session pinning", () => {
  const pinned = { modelRef: "test/a" };

  it("starts a new task from Effective.Model and sends nothing", () => {
    expect(displayedModel(noExplicitModel, "", undefined, "test/b")).toBe("test/b");
    expect(explicitModelRef(noExplicitModel, "", undefined)).toBeUndefined();
  });

  it("shows an existing session's pinned model even after the default changes", () => {
    expect(baselineModel(pinned, "test/b")).toBe("test/a");
    expect(displayedModel(noExplicitModel, "s1", pinned, "test/z")).toBe("test/a");
    expect(explicitModelRef(noExplicitModel, "s1", pinned)).toBeUndefined();
  });

  it("sends a different model only when the user chose it on this route", () => {
    const choice = chooseModel("test/b", "s1", pinned, "test/z");
    expect(choice).toEqual({ scope: "s1", ref: "test/b" });
    expect(displayedModel(choice, "s1", pinned, "test/z")).toBe("test/b");
    expect(explicitModelRef(choice, "s1", pinned)).toBe("test/b");
    // another route does not inherit the choice
    expect(displayedModel(choice, "s2", { modelRef: "test/c" }, "test/z")).toBe("test/c");
    expect(explicitModelRef(choice, "s2", { modelRef: "test/c" })).toBeUndefined();
    expect(explicitModelRef(choice, "", undefined)).toBeUndefined();
  });

  it("choosing the baseline again clears the choice", () => {
    expect(chooseModel("test/a", "s1", pinned, "test/z")).toEqual(noExplicitModel);
    expect(chooseModel("test/z", "", undefined, "test/z")).toEqual(noExplicitModel);
  });

  it("does not resend a choice the session is already pinned to", () => {
    expect(explicitModelRef({ scope: "s1", ref: "test/b" }, "s1", { modelRef: "test/b" })).toBeUndefined();
  });

  it("puts the explicit model, and no provider settings, in the agent config", () => {
    expect(buildAgentConfig("test/a", "workspace", 24)).toEqual({
      modelRef: "test/a",
      policy: "workspace",
      maxSteps: 24,
      recentMessages: 12,
      maxToolCallsPerStep: 8,
    });
    const keys = Object.keys(JSON.parse(JSON.stringify(buildAgentConfig(undefined, "read-only", 3))));
    expect(keys).not.toContain("modelRef");
    expect(keys).not.toContain("provider");
  });
});
