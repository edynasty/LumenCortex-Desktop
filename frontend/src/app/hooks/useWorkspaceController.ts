import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import { coreErrorKey } from "../../lib/core-errors";
import type { WorkspaceRoute } from "../workspace-route";
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
  // Zero limits mark the placeholder before Core's first answer; Core's bounds start at 1.
  concurrency: {
    current: { maxAgents: 0, maxChildrenPerParent: 0 },
    default: { maxAgents: 0, maxChildrenPerParent: 0 },
    max: { maxAgents: 0, maxChildrenPerParent: 0 },
  },
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

  // Reopening the app returns to the project the user last worked in. A project that can no
  // longer be opened (moved, deleted) leaves the welcome screen instead of showing an error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await bridge.state();
      if (cancelled) return;
      setState(current);
      const last = initialRecentProjects()[0];
      if (current.workspace || !last) return;
      setOpening(true);
      try {
        const opened = await bridge.openWorkspace(last);
        if (!cancelled) setState(opened);
      } catch {
        // Stay on the welcome screen.
      } finally {
        if (!cancelled) setOpening(false);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
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

  // Only the newest read is applied: a slow read of the previous project, or one started before a
  // save, must not replace what a later read returned.
  const configRequest = useRef(0);
  const refreshConfig = useCallback(async (): Promise<void> => {
    const request = ++configRequest.current;
    try {
      const next = await bridge.configState();
      if (request === configRequest.current) setConfig(next);
    } catch (err) {
      if (request === configRequest.current) setError(String(err));
    }
  }, [setError]);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig, state.workspace]);

  // lumencortex.json may change in an editor or the CLI while the app is in the background. The
  // listener needs one stable function so it can be removed.
  useEffect(() => {
    const reload = () => void refreshConfig();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [refreshConfig]);

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
    const request = ++configRequest.current;
    try {
      const next = await bridge.trustWorkspace(config.globalDigest);
      if (request === configRequest.current) setConfig(next);
    } catch (err) {
      const message = String(err);
      if (coreErrorKey(message) === "conflict") await refreshConfig();
      setError(message);
    } finally {
      setTrusting(false);
    }
  }, [config.globalDigest, refreshConfig, setError]);

  // The one-click repair for a retired subagentModel (ADR-0009): Core rewrites the global file and,
  // when one is open, the workspace file, then the app reads the configuration again.
  const migrateSubagentModel = useCallback(async (): Promise<void> => {
    try {
      await bridge.migrateSubagentModel();
    } catch (err) {
      setError(String(err));
      return;
    }
    await refreshConfig();
  }, [refreshConfig, setError]);

  return {
    state,
    setState,
    recentProjects,
    config,
    refreshConfig,
    trustWorkspace,
    migrateSubagentModel,
    trusting,
    opening,
    pickWorkspace,
    openWorkspace,
  };
}

type OmpImportSheetOptions = {
  workspace: string;
  setWorkspaceState: (state: WorkspaceState) => void;
  setError: (message: string) => void;
  resetSessionRuntime: () => void;
  setRoute: (route: WorkspaceRoute) => void;
};

// The sheet's contract: whether it is open, how it is opened or closed, and the session to open
// after an import.
export type OmpImportSheet = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openSession: (sessionId: string) => Promise<void>;
};

// The OMP import sheet (ADR-0011): whether it is open, and what happens after an import. An import
// writes sessions this app did not create itself, so the workspace is read again before the
// imported root is selected; the native thread view then shows it. A project switch closes the
// sheet, because its list belongs to the previous workspace.
export function useOmpImportSheet({ workspace, setWorkspaceState, setError, resetSessionRuntime, setRoute }: OmpImportSheetOptions): OmpImportSheet {
  const [open, setOpen] = useState(false);
  const lastWorkspace = useRef(workspace);
  useEffect(() => {
    if (lastWorkspace.current === workspace) return;
    lastWorkspace.current = workspace;
    setOpen(false);
  }, [workspace]);

  const openSession = useCallback(async (sessionId: string) => {
    setOpen(false);
    resetSessionRuntime();
    try {
      setWorkspaceState(await bridge.state());
    } catch (err) {
      setError(String(err));
    }
    setRoute({ kind: "thread", sessionId });
  }, [resetSessionRuntime, setError, setRoute, setWorkspaceState]);

  return { open, setOpen, openSession };
}
