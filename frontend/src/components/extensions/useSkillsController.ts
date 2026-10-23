import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { Skill, SkillScope } from "../../types";

const template =
  "---\n" +
  "name: New Skill\n" +
  "description: Describe when this skill should be used.\n" +
  "---\n\n" +
  "# Instructions\n\n" +
  "Add project-specific development instructions here.\n";

type Options = {
  workspace: string;
  /** The open workspace's trust, from the app's one trust source (ConfigState.trusted). */
  trusted: boolean;
  onError: (message: string) => void;
};

/** A row's identity: the id alone is not unique, a shadowed duplicate shares it with the winner. */
export function skillKey(skill: Pick<Skill, "scope" | "source" | "id">) {
  return `${skill.scope}:${skill.source}:${skill.id}`;
}

/** A row Core lists for its conflict only: a shadowed duplicate or a broken link has no body. */
export function skillBlocked(skill: Skill | null) {
  return Boolean(skill && (skill.shadowedBy || skill.error));
}

/**
 * The Skills pane's state. A scope lists every skill Core discovered there, including the ones a
 * higher root or the project scope shadows; "effective" lists only the winners a run may use
 * (ADR-0015). Every mutation goes to Core through the typed bridge.
 */
export function useSkillsController({ workspace, trusted, onError }: Options) {
  const [effective, setEffective] = useState<Skill[]>([]);
  const [globalSkills, setGlobalSkills] = useState<Skill[]>([]);
  const [projectSkills, setProjectSkills] = useState<Skill[]>([]);
  const [view, setView] = useState<SkillScope>("project");
  const [selectedKey, setSelectedKey] = useState("");
  const [draftId, setDraftId] = useState("");
  const [content, setContent] = useState(template);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

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
    } catch (err) {
      onError(String(err));
    }
  }, [onError, workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const skills = useMemo(
    () => (view === "effective" ? effective : view === "global" ? globalSkills : projectSkills),
    [effective, globalSkills, projectSkills, view]
  );
  const selected = useMemo(() => skills.find((skill) => skillKey(skill) === selectedKey) ?? null, [skills, selectedKey]);
  const blocked = skillBlocked(selected);
  /** A skill Core writes: LumenCortex's own root, not a link. Everything else is read-only. */
  const editable = Boolean(selected && !selected.readOnly && !blocked);
  const canToggle = Boolean(selected && !blocked);
  /** How many skills a run of this workspace actually receives (trusted project roots only). */
  const reachable = useMemo(
    () => effective.filter((skill) => skill.enabled && !skill.error && (trusted || skill.scope === "global")).length,
    [effective, trusted]
  );

  // A view switch or a mutation can leave the selection pointing at a row that is gone. A blocked
  // row opens for its details when the user picks it, but is never picked on the user's behalf.
  useEffect(() => {
    if (selectedKey && skills.some((skill) => skillKey(skill) === selectedKey)) return;
    const first = skills.find((skill) => !skillBlocked(skill));
    const next = first ? skillKey(first) : "";
    if (next !== selectedKey) setSelectedKey(next);
  }, [selectedKey, skills]);

  // Core has no body for a blocked row (for a shadowed id it would answer with the winner's).
  const loadId = selected && !blocked ? selected.id : "";
  useEffect(() => {
    if (!loadId) {
      if (blocked) setContent("");
      return;
    }
    let cancelled = false;
    bridge.skillContent(view, loadId)
      .then((next) => {
        if (!cancelled) {
          setDraftId(loadId);
          setContent(next);
        }
      })
      .catch((err) => {
        if (!cancelled) onError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [blocked, loadId, onError, view]);

  function beginNew() {
    setSelectedKey("");
    setDraftId("");
    setContent(template);
  }

  async function save() {
    const target = selected ? selected.scope : view;
    const id = (selected?.id ?? draftId).trim();
    if (target === "effective" || !id || !content.trim() || busy || (selected && !editable)) return;
    setBusy(true);
    try {
      await bridge.saveSkill(target, id, content);
      await refresh();
      setSelectedKey(skillKey({ scope: target, source: "lumencortex", id }));
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  /** Copy a foreign skill into the scope's LumenCortex root; the copy then shadows the original. */
  async function saveAsCopy() {
    if (!selected || blocked || busy) return;
    setBusy(true);
    try {
      await bridge.saveSkill(selected.scope, selected.id, content);
      setCopyOpen(false);
      await refresh();
      setSelectedKey(skillKey({ scope: selected.scope, source: "lumencortex", id: selected.id }));
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected || !editable || busy) return;
    setBusy(true);
    try {
      await bridge.deleteSkill(selected.scope, selected.id);
      setDeleteOpen(false);
      setSelectedKey("");
      await refresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled() {
    if (!selected || !canToggle || busy) return;
    setBusy(true);
    try {
      await bridge.setSkillEnabled(selected.scope, selected.id, !selected.enabled);
      await refresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return {
    effective,
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
  };
}
