import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { ConfigState } from "../../types";
import { ConcurrencySection } from "./SettingsPanes";

const mocks = vi.hoisted(() => ({ saveConcurrency: vi.fn() }));
vi.mock("../../lib/bridge", () => ({ bridge: { saveConcurrency: mocks.saveConcurrency } }));

const labels = copy.en;
const config = (maxAgents: number, maxChildrenPerParent: number): ConfigState => ({
  workspace: "",
  trusted: false,
  model: "",
  failover: [],
  models: [],
  warnings: [],
  globalPath: "/home/lumencortex.json",
  globalDigest: "sha256:g",
  concurrency: {
    current: { maxAgents, maxChildrenPerParent },
    default: { maxAgents: 4, maxChildrenPerParent: 3 },
    max: { maxAgents: 16, maxChildrenPerParent: 8 },
  },
});

describe("ConcurrencySection", () => {
  beforeEach(() => {
    mocks.saveConcurrency.mockReset();
  });

  it("saves edited limits with the digest it read, clamped to Core's bounds, then reloads", async () => {
    const user = userEvent.setup();
    const onConfigChanged = vi.fn();
    mocks.saveConcurrency.mockResolvedValue(config(16, 2));
    render(<ConcurrencySection labels={labels} config={config(4, 3)} onConfigChanged={onConfigChanged} onError={vi.fn()} />);

    const save = screen.getByRole("button", { name: labels.save });
    expect(save).toBeDisabled();
    const agents = screen.getByRole("spinbutton", { name: labels.settingsMaxAgents });
    await user.clear(agents);
    await user.type(agents, "40");
    expect(save).toBeDisabled();
    await user.tab();
    expect(agents).toHaveValue(16);
    const children = screen.getByRole("spinbutton", { name: labels.settingsMaxChildren });
    await user.clear(children);
    await user.type(children, "2");

    await user.click(save);
    expect(mocks.saveConcurrency).toHaveBeenCalledWith("sha256:g", { maxAgents: 16, maxChildrenPerParent: 2 });
    expect(onConfigChanged).toHaveBeenCalledTimes(1);
  });

  it("offers the defaults only when the limits differ from them", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ConcurrencySection labels={labels} config={config(4, 3)} onConfigChanged={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByRole("button", { name: labels.settingsConcurrencyDefaults })).toBeDisabled();

    rerender(<ConcurrencySection labels={labels} config={config(8, 6)} onConfigChanged={vi.fn()} onError={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: labels.settingsConcurrencyDefaults }));
    expect(screen.getByRole("spinbutton", { name: labels.settingsMaxAgents })).toHaveValue(4);
    expect(screen.getByRole("spinbutton", { name: labels.settingsMaxChildren })).toHaveValue(3);
    expect(screen.getByRole("button", { name: labels.save })).toBeEnabled();
  });

  it("reloads after a conflicting save and reports the error", async () => {
    const user = userEvent.setup();
    const onConfigChanged = vi.fn();
    const onError = vi.fn();
    // Wails rejects with the Go error's text.
    mocks.saveConcurrency.mockRejectedValue("config file changed since it was read: /home/lumencortex.json");
    render(<ConcurrencySection labels={labels} config={config(4, 3)} onConfigChanged={onConfigChanged} onError={onError} />);

    const agents = screen.getByRole("spinbutton", { name: labels.settingsMaxAgents });
    await user.clear(agents);
    await user.type(agents, "6");
    await user.click(screen.getByRole("button", { name: labels.save }));

    expect(onConfigChanged).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("config file changed"));
  });

  it("offers nothing to edit before Core's first configuration answer", () => {
    const placeholder = config(0, 0);
    placeholder.concurrency = {
      current: { maxAgents: 0, maxChildrenPerParent: 0 },
      default: { maxAgents: 0, maxChildrenPerParent: 0 },
      max: { maxAgents: 0, maxChildrenPerParent: 0 },
    };
    const { container } = render(<ConcurrencySection labels={labels} config={placeholder} onConfigChanged={vi.fn()} onError={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
