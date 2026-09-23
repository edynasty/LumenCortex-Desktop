import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import type { ProviderCatalog, ProviderSecretStatus, WorkspaceState } from "../../types";

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
};

export function useWorkspaceController({ setError }: Options) {
  const [state, setState] = useState<WorkspaceState>({
    workspace: "",
    sessions: [],
    activeRuns: [],
  });
  const [recentProjects, setRecentProjects] = useState<string[]>(initialRecentProjects);
  const [catalog, setCatalogState] = useState<ProviderCatalog>({ providers: {} });
  const [providerSecretStatuses, setProviderSecretStatuses] = useState<Record<string, ProviderSecretStatus>>({});
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
    bridge.providerCatalog().then(async (next) => {
      if (cancelled) return;
      setCatalogState(next);
      setModelRef((current) => modelExists(next, current) ? current : (next.model || ""));
      const statuses = await bridge.providerSecretStatuses();
      if (!cancelled) setProviderSecretStatuses(statuses);
    }).catch((err) => {
      if (!cancelled) setError(String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [setError, state.workspace]);

  const pickWorkspace = useCallback(async (): Promise<boolean> => {
    setError("");
    try {
      setState(await bridge.pickWorkspace());
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, [setError]);

  const openWorkspace = useCallback(async (path: string): Promise<boolean> => {
    setError("");
    try {
      setState(await bridge.openWorkspace(path));
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, [setError]);

  const setCatalog = useCallback((next: ProviderCatalog) => {
    setCatalogState(next);
    bridge.providerSecretStatuses()
      .then(setProviderSecretStatuses)
      .catch((err) => setError(String(err)));
  }, [setError]);

  return {
    state,
    setState,
    recentProjects,
    catalog,
    setCatalog,
    providerSecretStatuses,
    modelRef,
    setModelRef,
    pickWorkspace,
    openWorkspace,
  };
}
