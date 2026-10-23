import type { Skill } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Icon } from "../primitives/Icon";
import type { SkillLabels } from "./extensions-types";

type Props = {
  labels: SkillLabels;
  /** The skill the view selected; null while creating a new one. */
  selected: Skill | null;
  trusted: boolean;
  content: string;
  draftId: string;
  busy: boolean;
  enabled: boolean;
  /** Core writes this skill: LumenCortex's own root, not a link. */
  editable: boolean;
  canToggle: boolean;
  deleteOpen: boolean;
  copyOpen: boolean;
  onContent: (value: string) => void;
  onDraftId: (value: string) => void;
  onToggle: () => void;
  onDeleteOpen: (open: boolean) => void;
  onCopyOpen: (open: boolean) => void;
  onSave: () => void;
  onSaveAsCopy: () => void;
  onDelete: () => void;
};

/**
 * Detail column: where the skill comes from (path, root, resolved link), its enablement, and the
 * body. A foreign or linked skill is read-only here — it can be toggled and copied into the
 * LumenCortex root, never edited or deleted (ADR-0015 D2).
 */
export function SkillEditor({
  labels,
  selected,
  trusted,
  content,
  draftId,
  busy,
  enabled,
  editable,
  canToggle,
  deleteOpen,
  copyOpen,
  onContent,
  onDraftId,
  onToggle,
  onDeleteOpen,
  onCopyOpen,
  onSave,
  onSaveAsCopy,
  onDelete,
}: Props) {
  const id = (selected?.id ?? draftId).trim();
  const readOnlyBody = Boolean(selected && !editable);

  return (
    <div className="extensions-editor">
      <div className="extensions-editor-head">
        <div className="extensions-editor-id">
          <strong>{selected?.name || selected?.id || labels.add}</strong>
          <span className="mono">{selected ? selected.id : labels.content}</span>
        </div>
        {selected && (
          <div className="extensions-editor-actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !canToggle}
              title={canToggle ? undefined : labels.shadowedBy}
              onClick={onToggle}
            >
              {enabled ? labels.enabled : labels.disabled}
            </Button>
            {editable && (
              <Button
                variant="ghost"
                size="sm"
                className="is-danger"
                aria-label={labels.delete}
                title={labels.delete}
                disabled={busy}
                onClick={() => onDeleteOpen(true)}
              >
                <Icon name="delete" size={13} />
              </Button>
            )}
          </div>
        )}
      </div>

      {selected?.description && <p className="skill-description">{selected.description}</p>}

      {selected && (
        <dl className="extensions-stats skill-paths">
          <div>
            <dt>{labels.path}</dt>
            <dd className="mono">{selected.path}</dd>
          </div>
          <div>
            <dt>{labels.root}</dt>
            <dd className="mono">{selected.root}</dd>
          </div>
          {selected.realPath && (
            <div>
              <dt>{labels.realPath}</dt>
              <dd className="mono">{selected.realPath}</dd>
            </div>
          )}
        </dl>
      )}

      {selected?.readOnly && (
        <p className="extensions-note" role="note">
          <Icon name="lock" size={13} />
          <span>{labels.readOnlyNote}</span>
        </p>
      )}

      {selected?.scope === "project" && !trusted && (
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
            value={selected?.id ?? draftId}
            disabled={Boolean(selected)}
            onChange={(event) => onDraftId(event.target.value)}
            placeholder="java-backend"
          />
        </label>
        <label className="field span-2">
          <span className="field-label">{labels.content}</span>
          <textarea
            className={`input extensions-content ${readOnlyBody ? "is-readonly" : ""}`.trim()}
            value={content}
            readOnly={readOnlyBody}
            onChange={(event) => onContent(event.target.value)}
            spellCheck={false}
          />
        </label>
      </div>

      <footer className="editor-actions">
        {selected && !editable ? (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !content.trim()}
            onClick={() => onCopyOpen(true)}
          >
            {labels.saveAsCopy}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !id || !content.trim()}
            onClick={onSave}
          >
            {labels.save}
          </Button>
        )}
      </footer>

      <Dialog
        open={copyOpen}
        title={labels.saveAsCopyTitle}
        description={labels.saveAsCopyBody}
        closeLabel={labels.cancel}
        onOpenChange={onCopyOpen}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => onCopyOpen(false)}>
              {labels.cancel}
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={onSaveAsCopy}>
              {labels.saveAsCopy}
            </Button>
          </>
        }
      />

      <Dialog
        open={deleteOpen}
        title={labels.deleteTitle}
        description={labels.deleteBody}
        closeLabel={labels.cancel}
        onOpenChange={onDeleteOpen}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => onDeleteOpen(false)}>
              {labels.cancel}
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
              {labels.delete}
            </Button>
          </>
        }
      />
    </div>
  );
}
