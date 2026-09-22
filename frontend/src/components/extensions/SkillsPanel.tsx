import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { EmptyState } from "../primitives/EmptyState";
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
  labels: Labels;
  onError: (message: string) => void;
};

export function SkillsPanel({ workspace, labels, onError }: Props) {
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
  } = useSkillsController({ workspace, onError });

  return (
    <div className="skills-layout">
      <aside className="skills-list">
        <div className="mcp-list-head">
          <strong>{labels.title}</strong>
          <Button icon={<Plus size={12} />} onClick={beginNew}>{labels.add}</Button>
        </div>
        <div className="skills-list-body">
          {effective.map((skill) => (
            <button
              type="button"
              key={skill.id}
              className={skill.id === selectedId ? "selected" : ""}
              onClick={() => setSelectedId(skill.id)}
            >
              <span className={"skill-dot " + (skill.enabled ? "enabled" : "")} />
              <span>
                <strong>{skill.name || skill.id}</strong>
                <small>
                  {skill.enabled ? labels.enabled : labels.disabled}
                  {" · "}
                  {skill.scope === "project" ? labels.projectSource : labels.globalSource}
                </small>
              </span>
              {skill.error && <em title={skill.error}>!</em>}
            </button>
          ))}
          {!effective.length && (
            <EmptyState icon={<BookOpen size={20} />} title={labels.empty} />
          )}
        </div>
      </aside>

      <div className="skills-detail">
        <div className="mcp-scope-bar">
          <button
            type="button"
            className={scope === "global" ? "active" : ""}
            onClick={() => setScope("global")}
          >
            <span>{labels.globalScope}</span>
            <small>{labels.globalHint}</small>
          </button>
          <button
            type="button"
            className={scope === "project" ? "active" : ""}
            onClick={() => setScope("project")}
          >
            <span>{labels.projectScope}</span>
            <small>{labels.projectHint}</small>
          </button>
        </div>

        <section className="skill-editor">
          <div className="mcp-section-head">
            <div>
              <strong>{selectedId || labels.add}</strong>
              <span>{inherited ? labels.inherited : selectedEffective?.description || ""}</span>
            </div>
            <div>
              {selectedId && (
                <Button
                  disabled={busy || (scope === "global" && !selectedScoped)}
                  onClick={() => void toggleEnabled()}
                >
                  {enabled ? labels.enabled : labels.disabled}
                </Button>
              )}
              {selectedId && selectedScoped && (
                <Button
                  variant="danger"
                  icon={<Trash2 size={12} />}
                  disabled={busy}
                  onClick={() => setDeleteOpen(true)}
                >
                  {labels.delete}
                </Button>
              )}
            </div>
          </div>

          <div className="skill-editor-fields">
            <label>
              <span>{labels.id}</span>
              <input
                value={selectedId || draftId}
                disabled={Boolean(selectedId)}
                onChange={(event) => setDraftId(event.target.value)}
                placeholder="java-backend"
              />
            </label>
            <label className="skill-content-field">
              <span>{labels.content}</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                spellCheck={false}
              />
            </label>
          </div>

          {selectedEffective?.error && (
            <p className="mcp-runtime-error">
              <strong>{labels.error}</strong> {selectedEffective.error}
            </p>
          )}

          <div className="mcp-form-actions">
            <Button
              variant="primary"
              disabled={busy || !(selectedId || draftId).trim() || !content.trim()}
              onClick={() => void save()}
            >
              {labels.save}
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={deleteOpen}
        title={labels.deleteTitle}
        description={labels.deleteBody}
        closeLabel={labels.cancel}
        onOpenChange={setDeleteOpen}
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{labels.cancel}</Button>
            <Button variant="danger" disabled={busy} onClick={() => void remove()}>
              {labels.delete}
            </Button>
          </>
        }
      />
    </div>
  );
}
