import type { ReactNode } from "react";
import type { Skill, SkillSource } from "../../types";
import { Icon } from "../primitives/Icon";
import type { SkillLabels } from "./extensions-types";

/** Root conventions, not copy: these are the directory names Core reports. */
const SOURCE_LABEL: Record<SkillSource, string> = {
  lumencortex: "LumenCortex",
  agents: ".agents",
  claude: ".claude",
};

type Props = {
  skills: Skill[];
  selectedId: string;
  labels: SkillLabels;
  trusted: boolean;
  onSelect: (id: string) => void;
  /** The "add skill" row, appended to the same list. */
  footer?: ReactNode;
};

/**
 * One row per discovered skill: source, scope, link and read-only badges, the description, and the
 * conflict Core reports (a shadowed duplicate or a broken link). A row that cannot be opened is
 * dimmed and inert: Core has no content for a shadowed skill, and never offers a broken link.
 */
export function SkillList({ skills, selectedId, labels, trusted, onSelect, footer }: Props) {
  return (
    <ul className="provider-list skill-list">
      {skills.map((skill) => {
        const blocked = Boolean(skill.shadowedBy || skill.error);
        return (
          <li key={`${skill.scope}:${skill.source}:${skill.id}`}>
            <button
              type="button"
              className={`provider-row skill-row ${skill.id === selectedId ? "is-selected" : ""} ${blocked ? "is-blocked" : ""}`.trim()}
              aria-current={skill.id === selectedId ? "true" : undefined}
              aria-disabled={blocked || undefined}
              onClick={() => {
                if (!blocked) onSelect(skill.id);
              }}
            >
              <span className="provider-row-name">
                <span className={`run-dot ${skill.enabled && !blocked ? "is-on" : ""}`} aria-hidden />
                <span className="skill-row-name">{skill.name || skill.id}</span>
              </span>
              <span className="provider-row-sub skill-row-sub">
                <span>{skill.scope === "project" ? labels.projectScope : labels.globalScope}</span>
                <span aria-hidden>·</span>
                <span className="badge skill-badge">{SOURCE_LABEL[skill.source]}</span>
                {skill.linked && (
                  <span className="badge skill-badge" title={skill.realPath ?? skill.path}>
                    <Icon name="link" size={10} />
                    {labels.linked}
                  </span>
                )}
                {skill.readOnly && <span className="badge skill-badge">{labels.readOnly}</span>}
                {skill.overridden && <span className="badge skill-badge tone-accent">{labels.overridesGlobal}</span>}
                {skill.scope === "project" && !trusted && <span className="tone-warn">{labels.notLoaded}</span>}
              </span>
              {skill.description && <span className="skill-row-desc">{skill.description}</span>}
              {skill.shadowedBy && (
                <span className="skill-row-conflict">
                  {labels.shadowedBy} <span className="mono">{skill.shadowedBy}</span>
                </span>
              )}
              {skill.error && (
                <span className="skill-row-error">
                  <Icon name="failed" size={12} />
                  {skill.error}
                </span>
              )}
            </button>
          </li>
        );
      })}
      {footer}
    </ul>
  );
}
