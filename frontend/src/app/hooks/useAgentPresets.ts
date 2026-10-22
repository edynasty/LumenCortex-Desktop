import { useCallback, useState } from "react";
import type { AgentEntry } from "../../types";
import { presetDraft } from "../agent-catalog";

type Options = {
  /** Reads Core's compiled-in specialists; the page passes the catalog controller's loader. */
  loadPresets: () => Promise<AgentEntry[]>;
  /** The current catalog, for the name dedupe. */
  agents: AgentEntry[];
  /** The editor has unsaved edits: picking a preset must go through the page's confirm. */
  dirty: boolean;
  /** Opens the preset as an unsaved draft in the editor. */
  onDraft: (draft: AgentEntry) => void;
  /** Asks the page to show its unsaved-changes confirm. */
  onDirty: () => void;
};

export type AgentPresetsController = {
  open: boolean;
  presets: AgentEntry[] | null;
  loading: boolean;
  error: string;
  toggle: () => Promise<void>;
  close: () => void;
  pick: (preset: AgentEntry) => void;
  /** A pick is waiting for the dirty confirm. */
  hasPending: boolean;
  /** Opens the waiting preset after the user discarded their edits. */
  discardPending: () => void;
  /** Forgets the waiting preset when the user keeps editing. */
  keepEditing: () => void;
};

/**
 * The preset panel's state: the list is read on first open and kept, and a pick never writes
 * anything. A preset is turned into an unsaved draft, so the user still reviews and saves it.
 */
export function useAgentPresets({ loadPresets, agents, dirty, onDraft, onDirty }: Options): AgentPresetsController {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<AgentEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<AgentEntry | null>(null);

  const openDraft = useCallback((preset: AgentEntry) => {
    onDraft(presetDraft(preset, agents));
    setOpen(false);
    setPending(null);
  }, [agents, onDraft]);

  const toggle = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (presets || loading) return;
    setLoading(true);
    setError("");
    try {
      setPresets(await loadPresets());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  }, [loadPresets, loading, open, presets]);

  const pick = useCallback((preset: AgentEntry) => {
    if (dirty) {
      setPending(preset);
      onDirty();
      return;
    }
    openDraft(preset);
  }, [dirty, onDirty, openDraft]);

  const discardPending = useCallback(() => {
    if (pending) openDraft(pending);
  }, [openDraft, pending]);

  const keepEditing = useCallback(() => setPending(null), []);

  return {
    open,
    presets,
    loading,
    error,
    toggle,
    close: () => setOpen(false),
    pick,
    hasPending: pending !== null,
    discardPending,
    keepEditing,
  };
}
