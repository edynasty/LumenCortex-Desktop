/*
 * Core's plugin catalog and enablement (ADR-0012). Settings → Plugins and the Plugins page share
 * this: the switch writes first and re-reads, because Core may refuse the change and its state is
 * the truth. The rail reads the same controller, so enabling or disabling a plugin updates it.
 */
import { useCallback, useEffect, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { PluginCatalog, PluginInfo } from "../../types";

export type PluginCatalogState = "idle" | "loading" | "ready" | "error";

export type PluginCatalogController = {
  catalog: PluginCatalog | null;
  state: PluginCatalogState;
  error: string;
  busyId: string;
  toggleError: string;
  reload: () => Promise<void>;
  toggle: (plugin: PluginInfo) => Promise<void>;
};

export function usePluginCatalog({ enabled, labels, onError }: {
  /** Core refuses plugin calls without an open workspace, so the read waits for one. */
  enabled: boolean;
  labels: AppCopy;
  onError: (message: string) => void;
}): PluginCatalogController {
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
  const [state, setState] = useState<PluginCatalogState>(enabled ? "loading" : "idle");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [toggleError, setToggleError] = useState("");

  const reload = useCallback(async () => {
    if (!enabled) {
      setCatalog(null);
      setState("idle");
      setError("");
      return;
    }
    try {
      setCatalog(await bridge.plugins());
      setState("ready");
      setError("");
    } catch (err) {
      setCatalog(null);
      setState("error");
      setError(String(err));
    }
  }, [enabled]);

  useEffect(() => { void reload(); }, [reload]);

  const toggle = useCallback(async (plugin: PluginInfo) => {
    setBusyId(plugin.manifest.id);
    setToggleError("");
    try {
      await bridge.setPluginEnabled(plugin.manifest.id, !plugin.enabled);
      await reload();
    } catch (err) {
      setToggleError(`${labels.pluginsToggleError}: ${String(err)}`);
      onError(String(err));
    } finally {
      setBusyId("");
    }
  }, [labels.pluginsToggleError, onError, reload]);

  return { catalog, state, error, busyId, toggleError, reload, toggle };
}
