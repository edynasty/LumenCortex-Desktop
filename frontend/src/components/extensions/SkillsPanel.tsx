import { useState } from "react";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { useSkillsController } from "./useSkillsController";

type Labels = {
  title: string;
  add: string;
  empty: string;
  globalScope: string;
  projectScope: string;
  globalHint: string;
  projectHint: string;
  inherited: string;
  globalSource: string;
  projectSource: string;
  /** Shown on a project skill while the workspace is untrusted (ADR-0013). */
  notLoaded: string;
  enabled: string;
  disabled: string;
  id: string;
  content: string;
  save: string;
  delete: string;
  deleteTitle: string;
  deleteBody: string;
  cancel: string;
  error: string;
};

type Props = {
  workspace: string;
  /** The open workspace's trust, from the app's one trust source (ConfigState.trusted). */
  trusted: boolean;
  labels: Labels;
  onError: (message: string) => void;
};

/** Skills pane: Demo settings-sheet style — scope toolbar, provider-style skill list, editor column. */
export function SkillsPanel({ workspace, trusted, labels, onError }: Props) {
  const {
    effective,
    scope,
    setScope,
    selectedId,
    setSelectedId,
    draftId,
    setDraftId,
    content,
    setContent,
    busy,
    deleteOpen,
    setDeleteOpen,
    selectedEffective,
    selectedScoped,
    inherited,
    enabled,
    beginNew,
    save,
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
  const select = (id: string) => {
    setSelectedId(id);
    setCreating(false);
  };

  const showEditor = Boolean(selectedId) || creating || effective.length > 0;

  return (
    <>
      <div className="pane-toolbar">
        <SegmentedControl
          ariaLabel={labels.title}
          value={scope}
          onChange={setScope}
          options={[
            { value: "global", label: labels.globalScope, title: labels.globalScope },
            { value: "project", label: labels.projectScope, title: labels.projectScope },
          ]}
        />
        <span className="pane-hint">{scope === "global" ? labels.globalHint : labels.projectHint}</span>
      </div>

      <div className="provider-layout">
        <ul className="provider-list">
          {effective.map((skill) => (
            <li key={skill.id}>
              <button
                type="button"
                className={`provider-row ${skill.id === selectedId ? "is-selected" : ""}`}
                onClick={() => select(skill.id)}
              >
                <span className="provider-row-name">
                  <span className={`run-dot ${skill.enabled ? "is-on" : ""}`} aria-hidden />
                  {skill.name || skill.id}
                </span>
                <span className="provider-row-sub">
                  {skill.scope === "project" ? labels.projectSource : labels.globalSource}
                  {skill.scope === "project" && !trusted && (
                    <>
                      {" · "}
                      <span className="tone-warn">{labels.notLoaded}</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={`provider-row is-add ${!selectedId && creating ? "is-selected" : ""}`}
              onClick={startNew}
            >
              <Icon name="plus" size={14} />
              {labels.add}
            </button>
          </li>
        </ul>

        {!showEditor ? (
          <div className="empty-state">
            <Icon name="skill" size={22} />
            <h3>{labels.empty}</h3>
            <Button variant="secondary" size="sm" icon={<Icon name="plus" size={14} />} onClick={startNew}>
              {labels.add}
            </Button>
          </div>
        ) : (
          <div className="extensions-editor">
            <div className="extensions-editor-head">
              <div className="extensions-editor-id">
                <strong>{selectedId || labels.add}</strong>
                <span className="mono">
                  {selectedId
                    ? inherited ? labels.inherited : (selectedEffective?.description || "")
                    : labels.content}
                </span>
              </div>
              {selectedId && (
                <div className="extensions-editor-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || (scope === "global" && !selectedScoped)}
                    onClick={() => void toggleEnabled()}
                  >
                    {enabled ? labels.enabled : labels.disabled}
                  </Button>
                  {selectedScoped && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="is-danger"
                      aria-label={labels.delete}
                      title={labels.delete}
                      disabled={busy}
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Icon name="delete" size={13} />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {selectedId && selectedEffective?.scope === "project" && !trusted && (
              <p className="extensions-note" role="note">
                <Icon name="lock" size={13} />
                <span>{labels.notLoaded}</span>
              </p>
            )}

            <div className="form-grid">
              <label className="field">
                <span className="field-label">{labels.id}</span>
                <input
                  className="input mono"
                  value={selectedId || draftId}
                  disabled={Boolean(selectedId)}
                  onChange={(event) => setDraftId(event.target.value)}
                  placeholder="java-backend"
                />
              </label>
              <label className="field span-2">
                <span className="field-label">{labels.content}</span>
                <textarea
                  className="input extensions-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  spellCheck={false}
                />
              </label>
            </div>

            {selectedEffective?.error && (
              <p className="extensions-error">
                <Icon name="failed" size={13} />
                <span><strong>{labels.error}</strong> {selectedEffective.error}</span>
              </p>
            )}

            <footer className="editor-actions">
              <Button
                variant="primary"
                size="sm"
                disabled={busy || !(selectedId || draftId).trim() || !content.trim()}
                onClick={() => void save()}
              >
                {labels.save}
              </Button>
            </footer>
          </div>
        )}
      </div>

      <Dialog
        open={deleteOpen}
        title={labels.deleteTitle}
        description={labels.deleteBody}
        closeLabel={labels.cancel}
        onOpenChange={setDeleteOpen}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>
              {labels.cancel}
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => void remove()}>
              {labels.delete}
            </Button>
          </>
        }
      />
    </>
  );
}
