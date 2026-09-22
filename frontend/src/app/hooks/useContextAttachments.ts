import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { bridge } from "../../lib/bridge";

const MAX_CONTEXT_PATHS = 32;

type Options = {
  workspace: string;
  setError: Dispatch<SetStateAction<string>>;
};

export function useContextAttachments({ workspace, setError }: Options) {
  const [paths, setPaths] = useState<string[]>([]);

  const merge = useCallback((incoming: string[]) => {
    setPaths((current) => Array.from(new Set([...current, ...incoming])).slice(0, MAX_CONTEXT_PATHS));
  }, []);

  const pickFiles = useCallback(async () => {
    if (!workspace) return;
    try {
      merge(await bridge.pickContextFiles());
    } catch (err) {
      setError(String(err));
    }
  }, [merge, setError, workspace]);

  const pickDirectory = useCallback(async () => {
    if (!workspace) return;
    try {
      merge(await bridge.pickContextDirectory());
    } catch (err) {
      setError(String(err));
    }
  }, [merge, setError, workspace]);

  const remove = useCallback((path: string) => {
    setPaths((current) => current.filter((item) => item !== path));
  }, []);

  const clear = useCallback(() => {
    setPaths([]);
  }, []);

  return {
    paths,
    pickFiles,
    pickDirectory,
    remove,
    clear,
  };
}
