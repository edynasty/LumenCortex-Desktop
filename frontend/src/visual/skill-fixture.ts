import type { Skill, SkillScope } from "../types";

/**
 * The visual harness's skill roots and catalogue (ADR-0015): LumenCortex's own directories plus the
 * `.agents` and `.claude` conventions, one linked skill, one broken link, one same-scope duplicate
 * and one project override. Mutations change this in-memory copy the way Core changes its roots, so
 * toggling, saving and deleting are visible in the harness.
 */

type FixtureSkill = Skill & { content: string };

const ROOTS = {
  globalLumenCortex: "/Users/demo/.config/lumencortex/skills",
  globalAgents: "/Users/demo/.agents/skills",
  globalClaude: "/Users/demo/.claude/skills",
  projectLumenCortex: "/Users/demo/Projects/lumencortex/.lumencortex/skills",
  projectAgents: "/Users/demo/Projects/lumencortex/.agents/skills",
  projectClaude: "/Users/demo/Projects/lumencortex/.claude/skills",
};

/** Root precedence within a scope, highest first. */
const PRECEDENCE = ["lumencortex", "agents", "claude"] as const;

const body = (name: string, description: string, instructions: string[]) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# Instructions\n\n${instructions.map((line) => `- ${line}`).join("\n")}\n`;

const seed: FixtureSkill[] = [
  {
    id: "go-runtime",
    name: "Go Runtime",
    description: "Go service conventions, error handling and test layout",
    scope: "global",
    source: "lumencortex",
    root: ROOTS.globalLumenCortex,
    path: `${ROOTS.globalLumenCortex}/go-runtime/SKILL.md`,
    enabled: true,
    bytes: 488,
    content: body("Go Runtime", "Go service conventions, error handling and test layout", [
      "Return wrapped errors with context",
      "Keep goroutine lifetimes tied to a context",
      "Table tests for every boundary",
    ]),
  },
  {
    id: "frontend-desktop",
    name: "Desktop UI",
    description: "Desktop interaction and visual standards",
    scope: "global",
    source: "lumencortex",
    root: ROOTS.globalLumenCortex,
    path: `${ROOTS.globalLumenCortex}/frontend-desktop/SKILL.md`,
    enabled: true,
    bytes: 612,
    content: body("Desktop UI", "Desktop interaction and visual standards", [
      "Keep LumenCortex dense, calm and desktop-native",
      "Prefer compact controls and stable panel geometry",
    ]),
  },
  {
    id: "company-deploy",
    name: "Company deploy",
    description: "Deploy services to the internal Alibaba Cloud environment",
    scope: "global",
    source: "agents",
    root: ROOTS.globalAgents,
    path: `${ROOTS.globalAgents}/company-deploy/SKILL.md`,
    linked: true,
    realPath: "/Users/demo/src/shared-skills/company-deploy",
    readOnly: true,
    enabled: true,
    bytes: 9800,
    content: body("Company deploy", "Deploy services to the internal Alibaba Cloud environment", [
      "Check the Nacos namespace before deploying",
      "Run the Jenkins job, then verify the 92 port",
    ]),
  },
  {
    id: "design-review",
    name: "Design review",
    description: "Review a change against the Lumen Glass acceptance",
    scope: "global",
    source: "agents",
    root: ROOTS.globalAgents,
    path: `${ROOTS.globalAgents}/design-review/SKILL.md`,
    linked: true,
    readOnly: true,
    enabled: true,
    error: "broken link: /Users/demo/src/design-review",
    content: "",
  },
  {
    id: "frontend-desktop",
    name: "Desktop UI (Claude)",
    description: "Claude's copy of the desktop UI skill",
    scope: "global",
    source: "claude",
    root: ROOTS.globalClaude,
    path: `${ROOTS.globalClaude}/frontend-desktop/SKILL.md`,
    readOnly: true,
    enabled: true,
    bytes: 540,
    content: body("Desktop UI (Claude)", "Claude's copy of the desktop UI skill", ["Use the installed Claude copy"]),
  },
  {
    id: "frontend-desktop",
    name: "Desktop UI (project)",
    description: "This repository's own desktop UI rules",
    scope: "project",
    source: "lumencortex",
    root: ROOTS.projectLumenCortex,
    path: `${ROOTS.projectLumenCortex}/frontend-desktop/SKILL.md`,
    enabled: true,
    bytes: 640,
    content: body("Desktop UI (project)", "This repository's own desktop UI rules", [
      "Run the visual suite before a UI change",
      "Every production component stays under 350 lines",
    ]),
  },
  {
    id: "testing",
    name: "Testing",
    description: "Shared testing checklist for this repository",
    scope: "project",
    source: "agents",
    root: ROOTS.projectAgents,
    path: `${ROOTS.projectAgents}/testing/SKILL.md`,
    linked: true,
    realPath: "/Users/demo/src/shared-skills/testing",
    readOnly: true,
    enabled: true,
    bytes: 2200,
    content: body("Testing", "Shared testing checklist for this repository", ["Unit tests first", "Then the visual suite"]),
  },
  {
    id: "docs-style",
    name: "Docs style",
    description: "Documentation voice and structure",
    scope: "project",
    source: "claude",
    root: ROOTS.projectClaude,
    path: `${ROOTS.projectClaude}/docs-style/SKILL.md`,
    readOnly: true,
    enabled: false,
    bytes: 1200,
    content: body("Docs style", "Documentation voice and structure", ["Lead with the decision", "Link, do not copy"]),
  },
];

let state: FixtureSkill[] = seed.map((skill) => ({ ...skill }));

/** A scope's discovered skills with same-scope shadowing, as Core's scanScope reports it. */
function scopeSkills(scope: "global" | "project"): Skill[] {
  const rows = state.filter((skill) => skill.scope === scope);
  const owner = new Map<string, string>();
  const out: Skill[] = [];
  for (const source of PRECEDENCE) {
    for (const item of rows.filter((row) => row.source === source)) {
      const { content: _content, ...skill } = item;
      const shadow = owner.get(item.id);
      out.push(shadow ? { ...skill, shadowedBy: shadow } : skill);
      if (!shadow) owner.set(item.id, `${scope}:${source}`);
    }
  }
  return out.sort(
    (a, b) => a.id.localeCompare(b.id) || PRECEDENCE.indexOf(a.source) - PRECEDENCE.indexOf(b.source)
  );
}

/** The winners a run may use: project over global, `overridden` on the project entry. */
function effectiveSkills(): Skill[] {
  const merged = new Map<string, Skill>();
  for (const skill of scopeSkills("global")) {
    if (!skill.shadowedBy) merged.set(skill.id, skill);
  }
  for (const skill of scopeSkills("project")) {
    if (skill.shadowedBy) continue;
    merged.set(skill.id, { ...skill, overridden: merged.has(skill.id) || skill.overridden });
  }
  return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function parseMetadata(content: string, fallback: string): { name: string; description?: string } {
  const name = /^---\n[\s\S]*?\nname:\s*(.+)$/m.exec(content)?.[1]?.trim();
  const description = /^---\n[\s\S]*?\ndescription:\s*(.+)$/m.exec(content)?.[1]?.trim();
  return { name: name || fallback, description };
}

export function visualSkillList(scope: SkillScope): Skill[] {
  return scope === "effective" ? effectiveSkills() : scopeSkills(scope);
}

export function visualSkillContent(scope: SkillScope, id: string): string {
  const rows = scope === "effective" ? effectiveSkills() : scopeSkills(scope);
  const skill = rows.find((row) => row.id === id && !row.shadowedBy);
  if (!skill) throw new Error("file does not exist");
  if (skill.error) throw new Error(skill.error);
  const item = state.find(
    (row) => row.id === id && row.scope === skill.scope && row.source === skill.source
  );
  return item?.content ?? "";
}

/** Save into the scope's LumenCortex root: an existing foreign skill of that id is shadowed. */
export function visualSaveSkill(scope: SkillScope, id: string, content: string): void {
  if (scope !== "global" && scope !== "project") {
    throw new Error("skill write scope must be global or project");
  }
  const root = scope === "global" ? ROOTS.globalLumenCortex : ROOTS.projectLumenCortex;
  const meta = parseMetadata(content, id);
  const existing = state.find(
    (row) => row.scope === scope && row.id === id && row.source === "lumencortex" && !row.linked
  );
  if (existing) {
    existing.content = content;
    existing.name = meta.name;
    existing.description = meta.description;
    existing.bytes = content.length;
    return;
  }
  state.push({
    id,
    name: meta.name,
    description: meta.description,
    scope,
    source: "lumencortex",
    root,
    path: `${root}/${id}/SKILL.md`,
    enabled: true,
    bytes: content.length,
    content,
  });
}

export function visualDeleteSkill(scope: SkillScope, id: string): void {
  if (scope !== "global" && scope !== "project") {
    throw new Error("skill write scope must be global or project");
  }
  const index = state.findIndex(
    (row) => row.scope === scope && row.id === id && row.source === "lumencortex" && !row.linked
  );
  if (index < 0) {
    const other = state.find((row) => row.scope === scope && row.id === id);
    if (other) {
      throw new Error(
        `skill ${id} is read-only here (${other.root}): remove it with the tool that installed it, or disable it`
      );
    }
    throw new Error("file does not exist");
  }
  state.splice(index, 1);
}

/** Enablement is stored per scope and id, so it works for a foreign skill too. */
export function visualSetSkillEnabled(scope: SkillScope, id: string, enabled: boolean): void {
  if (scope !== "global" && scope !== "project") {
    throw new Error("skill enable scope must be global or project");
  }
  const rows = state.filter((row) => row.scope === scope && row.id === id);
  if (rows.length === 0) throw new Error(`unknown skill: ${id}`);
  for (const row of rows) row.enabled = enabled;
}
