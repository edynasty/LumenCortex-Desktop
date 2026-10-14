import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useModelSelection } from "./useModelSelection";

type Props = { model: string; session?: { modelRef?: string }; sessionId: string };

function render(initial: Props) {
  return renderHook((props: Props) => useModelSelection({ config: { model: props.model }, session: props.session, sessionId: props.sessionId }), { initialProps: initial });
}

describe("useModelSelection", () => {
  it("does not move a session when the configured default changes", () => {
    const { result, rerender } = render({ model: "test/b", session: { modelRef: "test/b" }, sessionId: "s1" });
    expect(result.current.modelRef).toBe("test/b");

    rerender({ model: "test/z", session: { modelRef: "test/b" }, sessionId: "s1" });
    expect(result.current.modelRef).toBe("test/b");
    expect(result.current.agentModelRef()).toBeUndefined();
  });

  it("follows the default on a new task until the user picks another model", () => {
    const { result, rerender } = render({ model: "test/b", sessionId: "" });
    expect(result.current.modelRef).toBe("test/b");
    rerender({ model: "test/c", sessionId: "" });
    expect(result.current.modelRef).toBe("test/c");

    act(() => result.current.selectModel("test/a"));
    expect(result.current.modelRef).toBe("test/a");
    expect(result.current.agentModelRef()).toBe("test/a");
    rerender({ model: "test/d", sessionId: "" });
    expect(result.current.agentModelRef()).toBe("test/a");

    act(() => result.current.resetModelChoice());
    expect(result.current.agentModelRef()).toBeUndefined();
  });

  it("pins a deliberate change to the session it was made on", () => {
    const { result, rerender } = render({ model: "test/b", session: { modelRef: "test/b" }, sessionId: "s1" });
    act(() => result.current.selectModel("test/a"));
    expect(result.current.agentModelRef()).toBe("test/a");

    rerender({ model: "test/b", session: { modelRef: "test/c" }, sessionId: "s2" });
    expect(result.current.modelRef).toBe("test/c");
    expect(result.current.agentModelRef()).toBeUndefined();
  });
});
