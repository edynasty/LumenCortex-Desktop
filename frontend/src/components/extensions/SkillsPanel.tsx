import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { Skill, SkillScope } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { EmptyState } from "../primitives/EmptyState";

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

const template =
  "---\n" +
  "name: New Skill\n" +
  "description: Describe when this skill should be used.\n" +
  "---\n\n" +
  "# Instructions\n\n" +
  "Add project-specific development instructions here.\n";

export function SkillsPanel({ workspace, labels, onError }: Props) {
  const [effective, setEffective] = useState<Skill[]>([]);
  const [globalSkills, setGlobalSkills] = useState<Skill[]>([]);
  const [projectSkills, setProjectSkills] = useState<Skill[]>([]);
  const [scope, setScope] = useState<Exclude<SkillScope, "effective">>("project");
  const [selectedId, setSelectedId] = useState("");
  const [draftId, setDraftId] = useState("");
  const [content, setContent] = useState(template);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspace) {
      setEffective([]);
      setGlobalSkills([]);
      setProjectSkills([]);
      return;
    }
    try {
      const [nextEffective, nextGlobal, nextProject] = await Promise.all([
        bridge.skills("effective"),
        bridge.skills("global"),
        bridge.skills("project"),
      ]);
      setEffective(nextEffective);
      setGlobalSkills(nextGlobal);
      setProjectSkills(nextProject);
      setSelectedId((current) =>
        current && nextEffective.some((skill) => skill.id === current)
          ? current
          : nextEffective[0]?.id || ""
      );
    } catch (err) {
      onError(String(err));
    }
  }, [onError, workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scopedSkills = scope === "global" ? globalSkills : projectSkills;
  const selectedEffective = useMemo(
    () => effective.find((skill) => skill.id === selectedId),
    [effective, selectedId]
  );
  const selectedScoped = useMemo(
    () => scopedSkills.find((skill) => skill.id === selectedId),
    [scopedSkills, selectedId]
  );
  const inherited = Boolean(selectedId && selectedEffective && !selectedScoped);

  useEffect(() => {
    if (!selectedId) return;
    const sourceScope: SkillScope = selectedScoped ? scope : "effective";
    let cancelled = false;
    bridge.skillContent(sourceScope, selectedId)
      .then((next) => {
        if (!cancelled) {
          setDraftId(selectedId);
          setContent(next);
        }
      })
      .catch((err) => {
        if (!cancelled) onError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [onError, scope, selectedId, selectedScoped]);

  function beginNew() {
    setSelectedId("");
    setDraftId("");
    setContent(template);
  }

  async function save() {
    const id = (selectedId || draftId).trim();
    if (!id || !content.trim() || busy) return;
    setBusy(true);
    try {
      await bridge.saveSkill(scope, id, content);
      await refresh();
      setSelectedId(id);
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId || !selectedScoped || busy) return;
    setBusy(true);
    try {
      await bridge.deleteSkill(scope, selectedId);
      setDeleteOpen(false);
      setSelectedId("");
      await refresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled() {
    if (!selectedId || !selectedEffective || busy) return;
    if (scope === "global" && !selectedScoped) return;
    const currentEnabled = selectedScoped?.enabled ?? selectedEffective.enabled;
    setBusy(true);
    try {
      await bridge.setSkillEnabled(scope, selectedId, !currentEnabled);
      await refresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const enabled = selectedScoped?.enabled ?? selectedEffective?.enabled ?? true;

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
