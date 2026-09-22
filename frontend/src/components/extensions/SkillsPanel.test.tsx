import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "../../types";
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

const labels = {
  title: "Skills",
  add: "Add skill",
  empty: "No skills yet",
  globalScope: "Global",
  projectScope: "Project",
  globalHint: "All projects",
  projectHint: "Current project",
  inherited: "Inherited",
  globalSource: "Global",
  projectSource: "Project",
  enabled: "Enabled",
  disabled: "Disabled",
  id: "Skill ID",
  content: "SKILL.md content",
  save: "Save",
  delete: "Delete",
  deleteTitle: "Delete skill?",
  deleteBody: "Delete it",
  cancel: "Cancel",
  error: "Skill error",
};

const globalSkill: Skill = {
  id: "go-backend",
  name: "Go Backend",
  description: "Go conventions",
  scope: "global",
  path: "/global/go-backend/SKILL.md",
  enabled: true,
};

function setupScopes(project: Skill[] = []) {
  const projectById = new Map(project.map((skill) => [skill.id, skill]));
  const effective = [
    ...[globalSkill].filter((skill) => !projectById.has(skill.id)),
    ...project,
  ];
  mocks.skills.mockImplementation(async (scope: string) => {
    if (scope === "global") return [globalSkill];
    if (scope === "project") return project;
    return effective;
  });
}

describe("SkillsPanel", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    setupScopes();
    mocks.skillContent.mockResolvedValue("---\nname: Go Backend\n---\n\n# Instructions\n");
    mocks.saveSkill.mockResolvedValue(undefined);
    mocks.deleteSkill.mockResolvedValue(undefined);
    mocks.setSkillEnabled.mockResolvedValue(undefined);
  });

  it("loads effective global skill content as inherited in project scope", async () => {
    render(<SkillsPanel workspace="/repo" labels={labels} onError={() => undefined} />);

    expect(await screen.findByText("Go Backend")).toBeInTheDocument();
    expect(await screen.findByDisplayValue(/name: Go Backend/)).toBeInTheDocument();
    expect(screen.getByText("Inherited")).toBeInTheDocument();
    expect(mocks.skillContent).toHaveBeenCalledWith("effective", "go-backend");
  });

  it("saves an inherited skill as a project override", async () => {
    const user = userEvent.setup();
    render(<SkillsPanel workspace="/repo" labels={labels} onError={() => undefined} />);

    const editor = await screen.findByDisplayValue(/name: Go Backend/);
    await user.clear(editor);
    await user.type(editor, "---\nname: Project Go\n---\n\nProject rules");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.saveSkill).toHaveBeenCalledWith(
        "project",
        "go-backend",
        expect.stringContaining("Project Go")
      );
    });
  });

  it("toggles a project skill enabled state through the typed bridge", async () => {
    const projectSkill = {
      ...globalSkill,
      scope: "project" as const,
      path: "/repo/.lumencortex/skills/go-backend/SKILL.md",
      enabled: true,
    };
    setupScopes([projectSkill]);
    const user = userEvent.setup();

    render(<SkillsPanel workspace="/repo" labels={labels} onError={() => undefined} />);

    await screen.findByText("Go Backend");
    await user.click(screen.getByRole("button", { name: "Enabled" }));

    await waitFor(() => {
      expect(mocks.setSkillEnabled).toHaveBeenCalledWith("project", "go-backend", false);
    });
  });
});
