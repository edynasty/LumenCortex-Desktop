import { useState } from "react";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import type { SkillLabels } from "./extensions-types";
import { SkillEditor } from "./SkillEditor";
import { SkillList } from "./SkillList";
import { useSkillsController } from "./useSkillsController";

type Props = {
  workspace: string;
  /** The open workspace's trust, from the app's one trust source (ConfigState.trusted). */
  trusted: boolean;
  labels: SkillLabels;
  onError: (message: string) => void;
};

/**
 * Skills pane: the discovered skills of a scope with their source and conflicts, the effective
 * set a run receives, and a detail column. Core discovers `~/.agents/skills`, `~/.claude/skills`
 * and their project counterparts; Desktop only presents what it reports (ADR-0015).
 */
export function SkillsPanel({ workspace, trusted, labels, onError }: Props) {
  const {
    skills,
    view,
    setView,
    selectedKey,
    setSelectedKey,
    selected,
    blocked,
    draftId,
    setDraftId,
    content,
    setContent,
    busy,
    deleteOpen,
    setDeleteOpen,
    copyOpen,
    setCopyOpen,
    editable,
    canToggle,
    reachable,
    beginNew,
    save,
    saveAsCopy,
    remove,
    toggleEnabled,
  } = useSkillsController({ workspace, trusted, onError });

  // "Add skill" clears the selection; track that intent so an empty catalogue still
  // switches the editor column from the empty state to the creation form.
  const [creating, setCreating] = useState(false);
  const startNew = () => {
    beginNew();
    setCreating(true);
  };
  const select = (key: string) => {
    setSelectedKey(key);
    setCreating(false);
  };
  const changeView = (next: typeof view) => {
    setView(next);
    setCreating(false);
  };

  const showEditor = Boolean(selected) || creating;
  const isNew = creating && !selected;
  const hint = view === "global" ? labels.globalHint : view === "project" ? labels.projectHint : labels.effectiveHint;

  return (
    <>
      <div className="pane-toolbar">
        <SegmentedControl
          ariaLabel={labels.title}
          value={view}
          onChange={changeView}
          options={[
            { value: "global", label: labels.globalScope, title: labels.globalScope },
            { value: "project", label: labels.projectScope, title: labels.projectScope },
            { value: "effective", label: labels.effectiveScope, title: labels.effectiveScope },
          ]}
        />
        <span className="pane-hint">{hint}</span>
      </div>

      <p className="skill-summary">
        <span>
          <strong>{reachable}</strong> {labels.reachable}
        </span>
        <span className="skill-summary-hint">{labels.catalogHint}</span>
      </p>

      <div className="provider-layout skill-layout">
        <SkillList
          skills={skills}
          selectedKey={selectedKey}
          labels={labels}
          trusted={trusted}
          onSelect={select}
          footer={
            view === "effective" ? undefined : (
              <li>
                <button
                  type="button"
                  className={`provider-row is-add ${isNew ? "is-selected" : ""}`}
                  onClick={startNew}
                >
                  <Icon name="plus" size={14} />
                  {labels.add}
                </button>
              </li>
            )
          }
        />

        {!showEditor ? (
          <div className="empty-state">
            <Icon name="skill" size={22} />
            <h3>{skills.length === 0 ? labels.empty : labels.select}</h3>
            {view !== "effective" && (
              <Button variant="secondary" size="sm" icon={<Icon name="plus" size={14} />} onClick={startNew}>
                {labels.add}
              </Button>
            )}
          </div>
        ) : (
          <SkillEditor
            labels={labels}
            selected={selected}
            blocked={blocked}
            trusted={trusted}
            content={content}
            draftId={draftId}
            busy={busy}
            enabled={selected?.enabled ?? true}
            editable={editable}
            canToggle={canToggle}
            deleteOpen={deleteOpen}
            copyOpen={copyOpen}
            onContent={setContent}
            onDraftId={setDraftId}
            onToggle={() => void toggleEnabled()}
            onDeleteOpen={setDeleteOpen}
            onCopyOpen={setCopyOpen}
            onSave={() => {
              setCreating(false);
              void save();
            }}
            onSaveAsCopy={() => void saveAsCopy()}
            onDelete={() => void remove()}
          />
        )}
      </div>
    </>
  );
}
