import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import { coreErrorKey } from "../../lib/core-errors";
import type { ConfigState, WorkspaceState } from "../../types";

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

const emptyConfig: ConfigState = {
  workspace: "",
  trusted: false,
  model: "",
  failover: [],
  models: [],
  warnings: [],
  globalPath: "",
  globalDigest: "",
};

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
  const [config, setConfig] = useState<ConfigState>(emptyConfig);
  const [opening, setOpening] = useState(false);
  const [trusting, setTrusting] = useState(false);

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

  const refreshConfig = useCallback(async (): Promise<void> => {
    try {
      setConfig(await bridge.configState());
    } catch (err) {
      setError(String(err));
    }
  }, [setError]);

  useEffect(() => {
    let cancelled = false;
    bridge.configState().then((next) => {
      if (!cancelled) setConfig(next);
    }).catch((err) => {
      if (!cancelled) setError(String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [setError, state.workspace]);

  const pickWorkspace = useCallback(async (): Promise<boolean> => {
    setError("");
    setOpening(true);
    try {
      setState(await bridge.pickWorkspace());
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setOpening(false);
    }
  }, [setError]);

  // Opening a project can migrate its database and wait for another process to release it, so
  // the UI shows it as busy until Core answers.
  const openWorkspace = useCallback(async (path: string): Promise<boolean> => {
    setError("");
    setOpening(true);
    try {
      setState(await bridge.openWorkspace(path));
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setOpening(false);
    }
  }, [setError]);

  // A changed global file is a conflict: Core wrote nothing, so reload and let the user decide again.
  const trustWorkspace = useCallback(async (): Promise<void> => {
    setTrusting(true);
    setError("");
    try {
      setConfig(await bridge.trustWorkspace(config.globalDigest));
    } catch (err) {
      const message = String(err);
      if (coreErrorKey(message) === "conflict") await refreshConfig();
      setError(message);
    } finally {
      setTrusting(false);
    }
  }, [config.globalDigest, refreshConfig, setError]);

  return {
    state,
    setState,
    recentProjects,
    config,
    refreshConfig,
    trustWorkspace,
    trusting,
    opening,
    pickWorkspace,
    openWorkspace,
  };
}
