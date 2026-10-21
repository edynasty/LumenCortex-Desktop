import { beforeEach, describe, expect, it } from "vitest";
import {
  baselineModel,
  chooseModel,
  displayedModel,
  effortsOfModel,
  executableModels,
  explicitModelRef,
  modelOptions,
  noExplicitModel,
  orderedEfforts,
  pickerModelOptions,
  pickerPlaceholder,
  pushRecentModel,
  readRecentModels,
  saveRecentModels,
  supportedEffort,
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
      efforts: [],
    }]);
  });

  it("shows a model display name without the provider prefix when the name is missing", () => {
    const options = modelOptions({
      model: "local/deepseek-v4.1-flash",
      models: [
        model("local/deepseek-v4.1-flash", { modelName: "", modelID: "deepseek-v4.1-flash", providerName: "Local" }),
        model("local/plain-model", { modelName: "", modelID: "", providerName: "Local" }),
      ],
    });
    expect(options.map((item) => item.label)).toEqual(["deepseek-v4.1-flash", "plain-model"]);
    // The ref stays intact for the picker, the tooltip and Core.
    expect(options.map((item) => item.ref)).toEqual(["local/deepseek-v4.1-flash", "local/plain-model"]);
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

  it("shows an agent's own first model, which is what Core runs", () => {
    expect(baselineModel(undefined, "test/d", { agentFirst: "test/x" })).toBe("test/x");
    expect(displayedModel(noExplicitModel, "", undefined, "test/d", { agentFirst: "test/x" })).toBe("test/x");
    // Picking the default is now a real choice, because Core would have run the agent's model.
    expect(chooseModel("test/d", "", undefined, "test/d", { agentFirst: "test/x" })).toEqual({ scope: "", ref: "test/d" });
    // Picking the agent's first model is the baseline again: nothing is sent.
    expect(chooseModel("test/x", "", undefined, "test/d", { agentFirst: "test/x" })).toEqual(noExplicitModel);
  });

  it("lets a switched agent's list win over the session pin", () => {
    expect(baselineModel(pinned, "test/d", { agentFirst: "test/x", switched: true })).toBe("test/x");
    // A switched agent without a list of its own starts from the default.
    expect(baselineModel(pinned, "test/d", { switched: true })).toBe("test/d");
    // The pin still wins while the agent is the thread's.
    expect(baselineModel(pinned, "test/d", { agentFirst: "test/x" })).toBe("test/a");
  });

  it("does not resend a choice the session is already pinned to", () => {
    expect(explicitModelRef({ scope: "s1", ref: "test/b" }, "s1", { modelRef: "test/b" })).toBeUndefined();
  });

  it("puts the explicit model, and no provider settings, in the agent config", () => {
    expect(buildAgentConfig("test/a", "workspace", 24)).toEqual({
      modelRef: "test/a",
      effort: undefined,
      policy: "workspace",
      maxSteps: 24,
      maxToolCallsPerStep: 8,
      delegation: "none",
      agent: undefined,
    });
    // The thread's grant is sent as the user set it; Core enforces it for that Start.
    expect(buildAgentConfig("test/a", "read-only", 24, "isolated").delegation).toBe("isolated");
    const keys = Object.keys(JSON.parse(JSON.stringify(buildAgentConfig(undefined, "read-only", 3))));
    expect(keys).not.toContain("modelRef");
    expect(keys).not.toContain("provider");
    // The request window is Core's (design §5); Desktop sends no row count.
    expect(keys).not.toContain("recentMessages");
  });
});

describe("picker placeholder", () => {
  const labels = { noModels: "No model configured", modelUnavailable: "{ref} (unavailable)" };
  const options = modelOptions({ model: "test/a", models: [model("test/a"), model("test/notools", { toolCalling: false })] });

  it("names a pinned model the picker does not offer instead of a generic placeholder", () => {
    expect(pickerPlaceholder("test/removed", options, labels)).toBe("test/removed (unavailable)");
    expect(pickerPlaceholder("test/notools", options, labels)).toBe("test/notools (unavailable)");
  });

  it("falls back to the no-model copy only when nothing is selected", () => {
    expect(pickerPlaceholder("", options, labels)).toBe("No model configured");
  });
});

describe("effort support", () => {
  const models = [
    { ...model("test/a"), efforts: ["low", "high"] },
    model("test/b"),
  ];

  it("lists a model's effort levels in Core's order", () => {
    expect(effortsOfModel("test/a", models)).toEqual(["low", "high"]);
    expect(effortsOfModel("test/b", models)).toEqual([]);
    expect(effortsOfModel("test/missing", models)).toEqual([]);
    expect(orderedEfforts(["max", "low", "none", "bogus"])).toEqual(["none", "low", "max"]);
    // Auto is a request value, never a per-model level.
    expect(orderedEfforts(["auto", "high", "low"])).toEqual(["low", "high"]);
  });

  it("sends only an effort the displayed model supports", () => {
    expect(supportedEffort("high", ["low", "high"])).toBe("high");
    expect(supportedEffort("high", ["low"])).toBeUndefined();
    expect(supportedEffort(undefined, ["low"])).toBeUndefined();
  });

  it("keeps auto for a model with levels and drops it for one without", () => {
    expect(supportedEffort("auto", ["low", "high"])).toBe("auto");
    expect(supportedEffort("auto", [])).toBeUndefined();
  });
});

describe("picker options", () => {
  it("shows refused models disabled with their reason, and carries efforts", () => {
    const options = pickerModelOptions(
      {
        model: "test/a",
        models: [
          { ...model("test/a"), efforts: ["low", "high"] },
          model("test/notools", { toolCalling: false }),
          model("test/nokey", { apiKeyEnv: "K", apiKeySet: false }),
          model("test/anon"),
        ],
      },
      { missingKey: "API key not set", noToolCalling: "No tool calling" },
    );
    expect(options.map((o) => [o.ref, o.disabled, o.disabledReason])).toEqual([
      ["test/a", false, undefined],
      ["test/notools", true, "No tool calling"],
      ["test/nokey", true, "API key not set"],
      ["test/anon", false, undefined],
    ]);
    expect(options[0].efforts).toEqual(["low", "high"]);
  });
});

describe("recent models", () => {
  beforeEach(() => localStorage.clear());

  it("is bounded, most recent first, deduplicated, and persists refs only", () => {
    expect(pushRecentModel([], "a/b")).toEqual(["a/b"]);
    expect(pushRecentModel(["a/b", "c/d"], "c/d")).toEqual(["c/d", "a/b"]);
    expect(pushRecentModel(["a", "b", "c", "d", "e"], "f")).toEqual(["f", "a", "b", "c", "d"]);
    expect(pushRecentModel(["a"], "")).toEqual(["a"]);

    saveRecentModels(["x/y", "z/w"]);
    expect(readRecentModels()).toEqual(["x/y", "z/w"]);
    expect(JSON.parse(localStorage.getItem("lcx-recent-models") ?? "[]")).toEqual(["x/y", "z/w"]);

    localStorage.setItem("lcx-recent-models", "not json");
    expect(readRecentModels()).toEqual([]);
    localStorage.setItem("lcx-recent-models", JSON.stringify(["ok", 42, null]));
    expect(readRecentModels()).toEqual(["ok"]);
  });
});
