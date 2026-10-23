import type { ReactNode } from "react";
import type { Skill, SkillSource } from "../../types";
import { Icon } from "../primitives/Icon";
import type { SkillLabels } from "./extensions-types";
import { skillBlocked, skillKey } from "./useSkillsController";

/** Root conventions, not copy: these are the directory names Core reports. */
const SOURCE_LABEL: Record<SkillSource, string> = {
  lumencortex: "LumenCortex",
  agents: ".agents",
  claude: ".claude",
};

type Props = {
  skills: Skill[];
  /** The selected row's skillKey (scope, source and id: a shadowed duplicate shares the id). */
  selectedKey: string;
  labels: SkillLabels;
  trusted: boolean;
  onSelect: (key: string) => void;
  /** The "add skill" row, appended to the same list. */
  footer?: ReactNode;
};

/**
 * One row per discovered skill: source, scope, link and read-only badges, the description, and the
 * conflict Core reports (a shadowed duplicate or a broken link). A conflicting row is dimmed but
 * still opens: its details say where it lives and why no run receives it.
 */
export function SkillList({ skills, selectedKey, labels, trusted, onSelect, footer }: Props) {
  return (
    <ul className="provider-list skill-list">
      {skills.map((skill) => {
        const key = skillKey(skill);
        const blocked = skillBlocked(skill);
        const current = key === selectedKey;
        return (
          <li key={key}>
            <button
              type="button"
              className={`provider-row skill-row ${current ? "is-selected" : ""} ${blocked ? "is-blocked" : ""}`.trim()}
              aria-current={current ? "true" : undefined}
              onClick={() => onSelect(key)}
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
