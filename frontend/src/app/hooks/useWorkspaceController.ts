import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import type { ProviderCatalog, WorkspaceState } from "../../types";

const MAX_RECENT_PROJECTS = 8;

function initialRecentProjects(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem("lcx-recent-projects") || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT_PROJECTS)
      : [];
  } catch {
    return [];
  }
}

function modelExists(catalog: ProviderCatalog, ref: string): boolean {
  if (!ref) return false;
  const slash = ref.indexOf("/");
  if (slash <= 0 || slash === ref.length - 1) return false;
  const providerID = ref.slice(0, slash);
  const modelID = ref.slice(slash + 1);
  return Boolean(catalog.providers?.[providerID]?.models?.[modelID]);
}

type Options = {
  setError: Dispatch<SetStateAction<string>>;
  onWorkspaceChanged: () => void;
};

export function useWorkspaceController({ setError, onWorkspaceChanged }: Options) {
  const [state, setState] = useState<WorkspaceState>({
    workspace: "",
    sessions: [],
    activeRuns: [],
  });
  const [recentProjects, setRecentProjects] = useState<string[]>(initialRecentProjects);
  const [catalog, setCatalog] = useState<ProviderCatalog>({ providers: {} });
  const [modelRef, setModelRef] = useState("");

  useEffect(() => {
    bridge.state().then(setState).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!state.workspace) return;
    setRecentProjects((current) => {
      const next = [
        state.workspace,
        ...current.filter((path) => path !== state.workspace),
      ].slice(0, MAX_RECENT_PROJECTS);
      localStorage.setItem("lcx-recent-projects", JSON.stringify(next));
      return next;
    });
  }, [state.workspace]);

  useEffect(() => {
    let cancelled = false;
    bridge.providerCatalog().then((next) => {
      if (cancelled) return;
      setCatalog(next);
      setModelRef((current) => modelExists(next, current) ? current : (next.model || ""));
    }).catch((err) => {
      if (!cancelled) setError(String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [setError, state.workspace]);

  const applyWorkspace = useCallback((next: WorkspaceState) => {
    setState(next);
    onWorkspaceChanged();
  }, [onWorkspaceChanged]);

  const pickWorkspace = useCallback(async () => {
    setError("");
    try {
      applyWorkspace(await bridge.pickWorkspace());
    } catch (err) {
      setError(String(err));
    }
  }, [applyWorkspace, setError]);

  const openWorkspace = useCallback(async (path: string) => {
    setError("");
    try {
      applyWorkspace(await bridge.openWorkspace(path));
    } catch (err) {
      setError(String(err));
    }
  }, [applyWorkspace, setError]);

  return {
    state,
    setState,
    recentProjects,
    catalog,
    setCatalog,
    modelRef,
    setModelRef,
    pickWorkspace,
    openWorkspace,
  };
}
