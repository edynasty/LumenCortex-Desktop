import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { CheckResult, ChecksInfo, RuntimeEvent } from "../../types";
import { CheckSummary } from "../review/CheckSummary";
import { ChecksPanel } from "./ChecksPanel";
import { checkResultsPage } from "./useChecks";

const mocks = vi.hoisted(() => ({
  sessionChecks: vi.fn(),
  checkResults: vi.fn(),
  checkArtifact: vi.fn(),
  acceptCheck: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels = copy.en;

function result(seq: number, patch: Partial<CheckResult> = {}): CheckResult {
  return { seq, check: "go-test", kind: "test", status: "failed", provenance: "runtime", fingerprint: "fp", artifacts: ["sha256:log", "sha256:diff"], at: "2026-10-17T00:00:00Z", ...patch };
}

function view(patch: Partial<ChecksInfo> = {}, newest: CheckResult | undefined = result(2)): ChecksInfo {
  return {
    sessionId: "s1",
    env: { head: "abcdef1234567", dirtyHash: "", worktreeId: "" },
    checks: [{ spec: { id: "go-test", kind: "test", command: "go test ./...", timeout: 1, required: true, source: "global" }, satisfied: false, newest }],
    ...patch,
  };
}

function event(seq: number, type: string, sessionId = "s1"): RuntimeEvent {
  return { seq, at: "2026-10-17T00:00:00Z", type, sessionId };
}

function panel(events: RuntimeEvent[] = [], onTrust = vi.fn()) {
  return <ChecksPanel sessionId="s1" events={events} configKey="sha256:one" trusting={false} labels={labels} onTrust={onTrust} />;
}

describe("ChecksPanel", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.checkResults.mockResolvedValue([result(2)]);
  });

  it("accepts a failing check and shows Core's view after the acceptance", async () => {
    const accepted = result(3, { status: "passed", provenance: "human:desktop-user", artifacts: [] });
    mocks.sessionChecks
      .mockResolvedValueOnce(view())
      .mockResolvedValueOnce(view({ checks: [{ ...view().checks![0], satisfied: true, deciding: accepted, newest: accepted }] }));
    mocks.acceptCheck.mockResolvedValue(accepted);
    mocks.checkResults.mockResolvedValueOnce([result(2)]).mockResolvedValueOnce([accepted, result(2)]);
    render(panel());

    await userEvent.click(await screen.findByRole("button", { name: labels.checksAccept }));

    expect(mocks.acceptCheck).toHaveBeenCalledWith("s1", "go-test");
    expect(await screen.findByText(`${labels.checksSatisfied} · ${labels.checksByHuman.replace("{actor}", "desktop-user")}`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: labels.checksAccept })).toBeNull();
  });

  it("offers no acceptance outside git and presents Core's refusal", async () => {
    mocks.sessionChecks.mockResolvedValue(view({ env: { head: "", dirtyHash: "", worktreeId: "" } }));
    render(panel());

    expect(await screen.findByText(labels.checksEnvNoGit)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.checksAccept })).toBeDisabled();

    mocks.sessionChecks.mockResolvedValue(view());
    mocks.acceptCheck.mockRejectedValue("Error: workspace has no fingerprint (not a git repository with a commit)");
    await userEvent.click(screen.getByRole("button", { name: labels.checksRefresh }));
    await userEvent.click(await screen.findByRole("button", { name: labels.checksAccept }));
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.errNoFingerprint);
  });

  it("does not count a passing result from an earlier state as satisfied", async () => {
    mocks.sessionChecks.mockResolvedValue(view({}, result(1, { status: "passed", artifacts: ["sha256:log"] })));
    render(panel());
    expect(await screen.findByText(labels.checksStale)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.checksAccept })).toBeEnabled();
  });

  it("opens and closes a result's log and diff", async () => {
    mocks.sessionChecks.mockResolvedValue(view());
    mocks.checkArtifact.mockImplementation(async (_s: string, hash: string) =>
      hash === "sha256:log"
        ? { hash, kind: "log", size: 10, truncated: true, text: "--- FAIL: TestX" }
        : { hash, kind: "diff", size: 10, truncated: false, text: "+changed line" });
    render(panel());
    const card = (await screen.findByText("go test ./...")).closest("li")!;

    await userEvent.click(within(card).getByRole("button", { name: labels.checksArtifactLog }));
    expect(await screen.findByText("--- FAIL: TestX")).toBeInTheDocument();
    expect(screen.getByText(labels.checksArtifactTruncated)).toBeInTheDocument();

    await userEvent.click(within(card).getByRole("button", { name: labels.checksArtifactDiff }));
    expect(await screen.findByText("+changed line")).toBeInTheDocument();
    expect(screen.queryByText("--- FAIL: TestX")).toBeNull();

    await userEvent.click(within(card).getByRole("button", { name: labels.checksArtifactDiff }));
    expect(screen.queryByText("+changed line")).toBeNull();
    expect(mocks.checkArtifact).toHaveBeenCalledTimes(2);
  });

  it("pages older results from the oldest seq shown", async () => {
    mocks.sessionChecks.mockResolvedValue(view());
    const first = Array.from({ length: checkResultsPage }, (_, i) => result(100 - i));
    mocks.checkResults.mockResolvedValueOnce(first).mockResolvedValueOnce([result(80), result(79)]);
    render(panel());

    await userEvent.click(await screen.findByRole("button", { name: labels.checksLoadMore }));

    expect(mocks.checkResults).toHaveBeenLastCalledWith("s1", 81, checkResultsPage);
    await waitFor(() => expect(screen.getAllByRole("listitem").filter((li) => li.classList.contains("check-row"))).toHaveLength(checkResultsPage + 2));
    expect(screen.queryByRole("button", { name: labels.checksLoadMore })).toBeNull();
  });

  it("shows the trust prompt for checks the configuration dropped", async () => {
    mocks.sessionChecks.mockResolvedValue(view({ warnings: [{ code: "untrusted_override", key: "checks.e2e", trustEntry: "/repo", message: "m" }] }));
    const onTrust = vi.fn();
    render(panel([], onTrust));

    expect(await screen.findByText("checks.e2e")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: labels.configTrustWorkspace }));
    expect(onTrust).toHaveBeenCalledTimes(1);
  });

  it("re-reads on this session's run end and acceptances only", async () => {
    mocks.sessionChecks.mockResolvedValue(view());
    const { rerender } = render(panel([event(1, "run.started")]));
    await waitFor(() => expect(mocks.sessionChecks).toHaveBeenCalledTimes(1));

    rerender(panel([event(1, "run.started"), event(2, "run.stopped", "other"), event(3, "tool.output")]));
    rerender(panel([event(1, "run.started"), event(2, "run.stopped", "other"), event(3, "tool.output"), event(4, "check.accepted")]));
    await waitFor(() => expect(mocks.sessionChecks).toHaveBeenCalledTimes(2));
  });
});

describe("CheckSummary", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("shows Core's verdict per configured check, not command exit codes", async () => {
    const accepted = result(3, { check: "build", status: "passed", provenance: "human:u", artifacts: [] });
    mocks.sessionChecks.mockResolvedValue(
      view({
        checks: [
          { spec: { id: "go-test", kind: "test", timeout: 1, required: true, source: "global" }, satisfied: false, newest: result(2) },
          { spec: { id: "build", kind: "build", timeout: 1, required: true, source: "global" }, satisfied: true, deciding: accepted, newest: accepted },
          { spec: { id: "lint", kind: "test", timeout: 1, required: false, source: "global" }, satisfied: false, newest: result(1, { check: "lint", status: "passed" }) },
          { spec: { id: "schema", kind: "schema", timeout: 1, required: false, source: "global" }, satisfied: false },
        ],
      }),
    );
    render(<CheckSummary sessionId="s1" revision={0} running={false} labels={labels} />);

    const row = async (id: string) => (await screen.findByText(id)).closest(".review-check")!;
    expect(await row("go-test")).toHaveTextContent(labels.checksStatusFailed);
    expect(await row("build")).toHaveTextContent(labels.checksSatisfied);
    expect(await row("lint")).toHaveTextContent(labels.checksStale);
    expect(await row("schema")).toHaveTextContent(labels.checksNeverRun);
  });

  it("renders nothing when no check is configured", async () => {
    mocks.sessionChecks.mockResolvedValue(view({ checks: [] }));
    const { container } = render(<CheckSummary sessionId="s1" revision={0} running={false} labels={labels} />);
    await waitFor(() => expect(mocks.sessionChecks).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
