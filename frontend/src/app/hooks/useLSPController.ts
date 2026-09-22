import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import { splitCommandArgs } from "../../lib/command-line";
import type { LSPDiagnostic, LSPStatus } from "../../types";

const stoppedStatus = (): LSPStatus => ({
  running: false,
  pendingRequests: 0,
  diagnostics: 0,
});

type Options = {
  workspace: string;
  selectedSessionId: string;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
};

export function useLSPController({
  workspace,
  selectedSessionId,
  busy,
  setBusy,
  setError,
}: Options) {
  const [command, setCommand] = useState(() => localStorage.getItem("lcx-lsp-command") || "gopls");
  const [args, setArgs] = useState(() => localStorage.getItem("lcx-lsp-args") || "");
  const [language, setLanguage] = useState(() => localStorage.getItem("lcx-lsp-language") || "go");
  const [status, setStatus] = useState<LSPStatus>(stoppedStatus);
  const [diagnosticPath, setDiagnosticPath] = useState("");
  const [diagnostics, setDiagnostics] = useState<LSPDiagnostic[]>([]);

  useEffect(() => {
    localStorage.setItem("lcx-lsp-command", command);
    localStorage.setItem("lcx-lsp-args", args);
    localStorage.setItem("lcx-lsp-language", language);
  }, [args, command, language]);

  const refreshStatus = useCallback(async () => {
    if (!workspace) {
      setStatus(stoppedStatus());
      return;
    }
    try {
      setStatus(await bridge.lspStatus(selectedSessionId || ""));
    } catch {
      setStatus(stoppedStatus());
    }
  }, [selectedSessionId, workspace]);

  useEffect(() => {
    setDiagnostics([]);
    void refreshStatus();
  }, [refreshStatus]);

  const start = useCallback(async () => {
    if (!workspace || busy || !command.trim()) return;
    setBusy(true);
    setError("");
    try {
      const next = await bridge.startLSP(selectedSessionId || "", {
        name: command.trim(),
        command: command.trim(),
        args: splitCommandArgs(args),
        languageId: language.trim() || undefined,
      });
      setStatus(next);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [args, busy, command, language, selectedSessionId, setBusy, setError, workspace]);

  const stop = useCallback(async () => {
    if (!workspace || busy) return;
    setBusy(true);
    setError("");
    try {
      await bridge.stopLSP(selectedSessionId || "");
      await refreshStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, refreshStatus, selectedSessionId, setBusy, setError, workspace]);

  const refreshDiagnostics = useCallback(async () => {
    if (!workspace || !status.running || !diagnosticPath.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const items = await bridge.lspDiagnostics(selectedSessionId || "", diagnosticPath.trim());
      setDiagnostics(items);
      await refreshStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, diagnosticPath, refreshStatus, selectedSessionId, setBusy, setError, status.running, workspace]);

  return {
    command,
    setCommand,
    args,
    setArgs,
    language,
    setLanguage,
    status,
    diagnosticPath,
    setDiagnosticPath,
    diagnostics,
    refreshStatus,
    start,
    stop,
    refreshDiagnostics,
  };
}
