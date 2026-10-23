import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "../../types";
import type { SkillLabels } from "./extensions-types";
import { SkillsPanel } from "./SkillsPanel";

const mocks = vi.hoisted(() => ({
  skills: vi.fn(),
  skillContent: vi.fn(),
  saveSkill: vi.fn(),
  deleteSkill: vi.fn(),
  setSkillEnabled: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

const labels: SkillLabels = {
  title: "Skills",
  add: "Add skill",
  empty: "No skills yet",
  globalScope: "Global",
  projectScope: "Project",
  effectiveScope: "Effective",
  globalHint: "All projects",
  projectHint: "Current project",
  effectiveHint: "What a run sees",
  notLoaded: "Not loaded (workspace not trusted)",
  enabled: "Enabled",
  disabled: "Disabled",
  id: "Skill ID",
  content: "SKILL.md content",
  save: "Save",
  saveAsCopy: "Save as LumenCortex copy",
  saveAsCopyTitle: "Save as a LumenCortex copy?",
  saveAsCopyBody: "It shadows the original.",
  delete: "Delete",
  deleteTitle: "Delete skill?",
  deleteBody: "Delete it",
  cancel: "Cancel",
  error: "Skill error",
  linked: "Link",
  readOnly: "Read-only",
  shadowedBy: "Shadowed by",
  overridesGlobal: "Overrides global",
  path: "Path",
  root: "Root",
  realPath: "Real path",
  readOnlyNote: "LumenCortex never modifies this skill.",
  brokenNote: "The link target does not exist.",
  shadowedNote: "A higher-priority source wins.",
  reachable: "enabled skills reach runs",
  catalogHint: "Runs get a catalog and load the full skill on demand.",
  select: "Select a skill to see its details",
};

const lcGlobal: Skill = {
  id: "go-runtime",
  name: "Go Runtime",
  description: "Backend runtime rules",
  scope: "global",
  source: "lumencortex",
  root: "/home/.config/lumencortex/skills",
  path: "/home/.config/lumencortex/skills/go-runtime/SKILL.md",
  enabled: true,
};

const agentsLinked: Skill = {
  id: "company-deploy",
  name: "Company deploy",
  scope: "global",
  source: "agents",
  root: "/home/.agents/skills",
  path: "/home/.agents/skills/company-deploy/SKILL.md",
  linked: true,
  realPath: "/home/src/shared-skills/company-deploy",
  readOnly: true,
  enabled: true,
};

const claudeDuplicate: Skill = {
  id: "go-runtime",
  name: "Go Runtime (Claude)",
  scope: "global",
  source: "claude",
  root: "/home/.claude/skills",
  path: "/home/.claude/skills/go-runtime/SKILL.md",
  readOnly: true,
  enabled: true,
  shadowedBy: "global:lumencortex",
};

const brokenLink: Skill = {
  id: "design-review",
  name: "Design review",
  scope: "global",
  source: "agents",
  root: "/home/.agents/skills",
  path: "/home/.agents/skills/design-review/SKILL.md",
  linked: true,
  readOnly: true,
  enabled: true,
  error: "broken link: /home/src/design-review",
};

const projectOwned: Skill = {
  id: "frontend-desktop",
  name: "Desktop UI (project)",
  description: "This repository's desktop rules",
  scope: "project",
  source: "lumencortex",
  root: "/repo/.lumencortex/skills",
  path: "/repo/.lumencortex/skills/frontend-desktop/SKILL.md",
  enabled: true,
  overridden: true,
};

const projectClaude: Skill = {
  id: "docs-style",
  name: "Docs style",
  scope: "project",
  source: "claude",
  root: "/repo/.claude/skills",
  path: "/repo/.claude/skills/docs-style/SKILL.md",
  readOnly: true,
  enabled: true,
};

function setupScopes(options: { global?: Skill[]; project?: Skill[]; effective?: Skill[] }) {
  const global = options.global ?? [];
  const project = options.project ?? [];
  const effective = options.effective ?? [...global, ...project];
  mocks.skills.mockImplementation(async (scope: string) => {
    if (scope === "global") return global;
    if (scope === "project") return project;
    return effective;
  });
}

function renderPanel(options?: { trusted?: boolean; onError?: (message: string) => void }) {
  return render(
    <SkillsPanel
      workspace="/repo"
      trusted={options?.trusted ?? true}
      labels={labels}
      onError={options?.onError ?? (() => undefined)}
    />
  );
}

async function showScope(name: string) {
  await userEvent.setup().click(screen.getByRole("radio", { name }));
}

describe("SkillsPanel", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    setupScopes({ global: [lcGlobal, agentsLinked] });
    mocks.skillContent.mockResolvedValue("---\nname: Go Runtime\n---\n\n# Instructions\n");
    mocks.saveSkill.mockResolvedValue(undefined);
    mocks.deleteSkill.mockResolvedValue(undefined);
    mocks.setSkillEnabled.mockResolvedValue(undefined);
  });

  it("shows each skill's source, scope and link badges with the resolved path", async () => {
    renderPanel();
    await showScope("Global");

    const linked = await screen.findByRole("button", { name: /Company deploy/ });
    expect(within(linked).getByText(".agents")).toBeInTheDocument();
    expect(within(linked).getByText("Link")).toBeInTheDocument();
    expect(within(linked).getByText("Read-only")).toBeInTheDocument();
    expect(within(linked).getByText("Global")).toBeInTheDocument();
    expect(within(linked).getByTitle("/home/src/shared-skills/company-deploy")).toBeInTheDocument();

    const owned = screen.getByRole("button", { name: /Go Runtime/ });
    expect(within(owned).getByText("LumenCortex")).toBeInTheDocument();
    expect(within(owned).queryByText("Read-only")).not.toBeInTheDocument();
  });

  it("opens a shadowed duplicate's own details without loading the winner's body", async () => {
    setupScopes({ global: [lcGlobal, claudeDuplicate] });
    renderPanel();
    await showScope("Global");

    const shadowed = await screen.findByRole("button", { name: /Go Runtime \(Claude\)/ });
    expect(shadowed).toHaveTextContent("Shadowed by global:lumencortex");
    // The winner (same id) is selected first and its body loaded.
    await screen.findByLabelText("SKILL.md content");

    const before = mocks.skillContent.mock.calls.length;
    await userEvent.setup().click(shadowed);

    expect(shadowed).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /^Go Runtime\b(?! \(Claude\))/ })).not.toHaveAttribute("aria-current");
    expect(await screen.findByRole("alert")).toHaveTextContent("A higher-priority source wins.");
    expect(screen.getByText("/home/.claude/skills/go-runtime/SKILL.md")).toBeInTheDocument();
    expect(screen.queryByLabelText("SKILL.md content")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enabled" })).not.toBeInTheDocument();
    expect(mocks.skillContent.mock.calls.length).toBe(before);
  });

  it("opens a broken link for its path and target, never for a body", async () => {
    setupScopes({ global: [lcGlobal, brokenLink] });
    renderPanel();
    await showScope("Global");

    const row = await screen.findByRole("button", { name: /Design review/ });
    expect(row).toHaveTextContent("broken link: /home/src/design-review");

    await userEvent.setup().click(row);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The link target does not exist.");
    expect(alert).toHaveTextContent("broken link: /home/src/design-review");
    expect(screen.getByText("/home/.agents/skills/design-review/SKILL.md")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save as LumenCortex copy" })).not.toBeInTheDocument();
    expect(mocks.skillContent).not.toHaveBeenCalledWith("global", "design-review");
  });

  it("toggles a read-only skill and offers no delete or edit", async () => {
    setupScopes({ global: [agentsLinked] });
    renderPanel();
    await showScope("Global");

    const editor = await screen.findByLabelText("SKILL.md content");
    expect(editor).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Enabled" }));

    await waitFor(() => {
      expect(mocks.setSkillEnabled).toHaveBeenCalledWith("global", "company-deploy", false);
    });
  });

  it("saves a read-only skill as a LumenCortex copy after confirming the shadowing", async () => {
    setupScopes({ global: [agentsLinked] });
    renderPanel();
    await showScope("Global");

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Save as LumenCortex copy" }));
    const dialog = await screen.findByRole("dialog", { name: "Save as a LumenCortex copy?" });
    expect(dialog).toHaveTextContent("It shadows the original.");
    await user.click(within(dialog).getByRole("button", { name: "Save as LumenCortex copy" }));

    await waitFor(() => {
      expect(mocks.saveSkill).toHaveBeenCalledWith(
        "global",
        "company-deploy",
        expect.stringContaining("name: Go Runtime")
      );
    });
  });

  it("keeps edit, save and delete for a LumenCortex-owned skill", async () => {
    setupScopes({ project: [projectOwned] });
    renderPanel();

    const editor = await screen.findByLabelText("SKILL.md content");
    expect(editor).not.toHaveAttribute("readonly");
    expect(screen.getByText("Overrides global")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.clear(editor);
    await user.type(editor, "---\nname: Project UI\n---\n");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mocks.saveSkill).toHaveBeenCalledWith("project", "frontend-desktop", expect.stringContaining("Project UI"));
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete skill?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mocks.deleteSkill).toHaveBeenCalledWith("project", "frontend-desktop");
    });
  });

  it("shows only winners in the effective view and counts what reaches a run", async () => {
    setupScopes({
      global: [lcGlobal, agentsLinked, claudeDuplicate],
      project: [projectOwned],
      effective: [lcGlobal, agentsLinked, projectOwned],
    });
    renderPanel();
    await showScope("Effective");

    expect(await screen.findByText("Overrides global")).toBeInTheDocument();
    expect(screen.queryByText("Go Runtime (Claude)")).not.toBeInTheDocument();
    const summary = document.querySelector(".skill-summary");
    expect(summary).toHaveTextContent("3 enabled skills reach runs");
    expect(summary).toHaveTextContent("Runs get a catalog");
  });

  it("marks a project skill as not loaded while the workspace is untrusted", async () => {
    setupScopes({ project: [projectClaude] });
    renderPanel({ trusted: false });

    expect(await screen.findByText("Docs style")).toBeInTheDocument();
    // The catalogue row and the editor both say the skill is not loaded.
    expect(screen.getAllByText("Not loaded (workspace not trusted)").length).toBeGreaterThan(1);
  });
});
