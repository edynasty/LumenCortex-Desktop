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
  onError: (message: string) => void;
};

export function useSkillsController({ workspace, onError }: Options) {
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
  const enabled = selectedScoped?.enabled ?? selectedEffective?.enabled ?? true;

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

  return {
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
  };
}
