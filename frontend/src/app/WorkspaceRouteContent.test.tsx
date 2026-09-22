import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copy } from "../lib/i18n/app-copy";
import { WorkspaceRouteContent } from "./WorkspaceRouteContent";

vi.mock("../components/provider/ProviderSettingsPanel", () => ({
  ProviderSettingsPanel: () => <input aria-label="Provider draft" defaultValue="" />,
}));

vi.mock("../components/composer/NewTaskComposer", () => ({
  NewTaskComposer: () => <div>New task route</div>,
}));

vi.mock("../components/thread/ThreadWorkspace", () => ({
  ThreadWorkspace: () => <div>Thread route</div>,
}));

vi.mock("./WorkspaceExtensionsRoute", () => ({
  WorkspaceExtensionsRoute: () => <div>Extensions route</div>,
}));

vi.mock("./WorkspaceReviewRoute", () => ({
  WorkspaceReviewRoute: () => <div>Review route</div>,
}));

const noop = () => undefined;
const baseProps: ComponentProps<typeof WorkspaceRouteContent> = {
  route: { kind: "providers" },
  runtime: { kind: "local", path: "/repo/demo" },
  locale: "en",
  labels: copy.en,
  workspace: "/repo/demo",
  recentProjects: [],
  catalog: { providers: {} },
  modelRef: "",
  configuredModels: [],
  contextPaths: [],
  policy: "workspace",
  runtimeKind: "local",
  goal: "",
  busy: false,
  messages: [],
  messageAtLatest: true,
  messageLoadingOlder: false,
  running: false,
  workflowSummary: null,
  subagents: [],
  textareaRef: null,
  onCatalogChange: noop,
  onModelChange: noop,
  onError: noop,
  onGoalChange: noop,
  onPickContextFiles: noop,
  onPickContextFolder: noop,
  onRemoveContextPath: noop,
  onPolicyChange: noop,
  onRuntimeChange: noop,
  onPickWorkspace: noop,
  onOpenWorkspace: noop,
  onOpenProviders: noop,
  onApproveGate: noop,
  onLoadOlderMessages: noop,
  onJumpToLatest: noop,
  onCancel: noop,
  onRetry: noop,
  onSubmit: (event) => event.preventDefault(),
  onKeyDown: noop,
  onSendReviewInstruction: async () => undefined,
};

describe("WorkspaceRouteContent provider keepalive", () => {
  it("keeps an unsaved provider draft in memory across route changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WorkspaceRouteContent {...baseProps} />);

    const draft = screen.getByRole("textbox", { name: "Provider draft" });
    await user.type(draft, "unsaved-provider");
    expect(draft).toHaveValue("unsaved-provider");

    rerender(
      <WorkspaceRouteContent
        {...baseProps}
        route={{ kind: "new-task" }}
      />
    );

    expect(screen.getByText("New task route")).toBeVisible();
    expect(draft).not.toBeVisible();

    rerender(<WorkspaceRouteContent {...baseProps} />);
    expect(screen.getByRole("textbox", { name: "Provider draft" })).toHaveValue("unsaved-provider");
  });

  it("does not mount Provider settings before the route is first visited", () => {
    render(
      <WorkspaceRouteContent
        {...baseProps}
        route={{ kind: "new-task" }}
      />
    );

    expect(screen.queryByRole("textbox", { name: "Provider draft" })).not.toBeInTheDocument();
  });
});
